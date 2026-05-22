/**
 * Sync de todos os produtos de UMA categoria
 * POST /api/admin/sync-categoria
 * body: { categoria: string, limite?: number }
 *
 * Para cada produto da categoria:
 *   - Busca produto.obter.php (imagens, descrição, etc.)
 *   - Atualiza todos os campos no banco
 *   - Delay 1.2s entre produtos para não sobrecarregar a API Tiny
 *
 * Retorna progresso incremental — o frontend chama em loop.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchTinyProduct, fetchTinyProductEstoque, extrairImagensTiny } from '@/lib/olist/client'

export const maxDuration = 60

export async function GET(_req: Request) {
  // Lista categorias disponíveis no banco
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const cats = await prisma.product.findMany({
    where: { ativo: true, tinyId: { not: null } },
    select: { categoria: true },
    distinct: ['categoria'],
    orderBy: { categoria: 'asc' },
  })

  // Contagem por categoria
  const contagem = await Promise.all(
    cats.map(async ({ categoria }) => {
      const total = await prisma.product.count({ where: { categoria, ativo: true } })
      const semImagem = await prisma.product.count({
        where: { categoria, ativo: true, temImagem: false },
      })
      return { categoria: categoria || 'Sem categoria', total, semImagem }
    })
  )

  return NextResponse.json({ categorias: contagem })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { categoria, offset = 0, lote = 10 } = body

  if (!categoria) {
    return NextResponse.json({ error: 'Parâmetro "categoria" obrigatório' }, { status: 400 })
  }

  // Busca lote de produtos da categoria sem imagem (prioridade) ou todos
  const produtos = await prisma.product.findMany({
    where: {
      categoria,
      ativo: true,
      tinyId: { not: null },
    },
    select: { id: true, tinyId: true, nome: true, temImagem: true, imagens: true },
    orderBy: [
      { temImagem: 'asc' },   // sem imagem primeiro
      { updatedAt: 'asc' },
    ],
    skip: offset,
    take: lote,
  })

  const total = await prisma.product.count({
    where: { categoria, ativo: true, tinyId: { not: null } },
  })

  if (produtos.length === 0) {
    return NextResponse.json({
      ok: true,
      processados: 0,
      total,
      offset,
      done: true,
      msg: 'Todos os produtos da categoria já foram sincronizados!',
    })
  }

  let atualizados = 0
  let erros = 0
  const detalhes: string[] = []

  for (const produto of produtos) {
    try {
      const detalhe = await fetchTinyProduct(produto.tinyId!)

      if (!detalhe) {
        await prisma.product.update({
          where: { id: produto.id },
          data: { ativo: false, imagensVerificadas: true },
        })
        erros++
        continue
      }

      const imagens = extrairImagensTiny(detalhe)
      const descricao = detalhe.descricao_complementar || detalhe.obs || detalhe.descricao_curta || undefined
      const preco = detalhe.preco ? Number(detalhe.preco) : undefined
      const precoPromocional = detalhe.preco_promocional && Number(detalhe.preco_promocional) > 0
        ? Number(detalhe.preco_promocional)
        : null
      const cat = detalhe.categoria?.descricao || (typeof detalhe.categoria === 'string' ? detalhe.categoria : undefined)
      const marca = detalhe.marca || undefined
      const tinyAtivo = detalhe.situacao === 'A' || detalhe.situacao === 'Ativo'
      const estoque = await fetchTinyProductEstoque(produto.tinyId!)

      // Determina imagens finais e se tem imagem
      const finalImagens = imagens.length > 0 ? imagens : (produto.imagens as any[] || [])
      const temImagem = finalImagens.length > 0
      const finalAtivo = tinyAtivo && temImagem && (estoque >= 0 ? estoque : 0) > 0

      const campos: Record<string, any> = {
        imagensVerificadas: true,
        temImagem,
        ativo: finalAtivo,
        ...(descricao   && { descricao }),
        ...(preco       !== undefined && { preco }),
        ...(precoPromocional !== undefined && { precoPromocional }),
        ...(cat         && { categoria: cat }),
        ...(marca       && { marca }),
        ...(estoque >= 0 && { estoque }),
      }
      if (imagens.length > 0) campos.imagens = imagens

      await prisma.product.update({ where: { id: produto.id }, data: campos })
      atualizados++
      if (imagens.length > 0) detalhes.push(`✓ ${produto.nome.slice(0, 30)} (${imagens.length} fotos)`)
      else detalhes.push(`○ ${produto.nome.slice(0, 30)} (sem foto no Tiny)`)
    } catch (e: any) {
      console.error('[sync-cat]', produto.tinyId, e.message)
      erros++
    }
  }

  const nextOffset = offset + produtos.length
  const done = nextOffset >= total

  return NextResponse.json({
    ok: true,
    processados: produtos.length,
    atualizados,
    erros,
    total,
    offset: nextOffset,
    done,
    detalhes,
  })
}
