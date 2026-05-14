/**
 * Sync completo de 1 produto com o Tiny
 * POST /api/admin/produtos/[id]/sync
 *
 * Busca produto.obter.php e atualiza TODOS os campos:
 * nome, preço, estoque, imagens, descrição, categoria, marca, situação
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchTinyProduct, fetchTinyProductEstoque, extrairImagensTiny } from '@/lib/olist/client'

export const maxDuration = 30

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // Busca produto no banco
  const produto = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true, tinyId: true, nome: true, sku: true },
  })

  if (!produto) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  if (!produto.tinyId) {
    return NextResponse.json({ error: 'Produto não tem tinyId — não pode ser sincronizado com o Tiny' }, { status: 400 })
  }

  try {
    // Busca dados completos no Tiny (inclui fotos, descrição, etc.)
    const detalhe = await fetchTinyProduct(produto.tinyId)

    if (!detalhe) {
      // Produto sumiu do Tiny → marca como inativo
      await prisma.product.update({
        where: { id: params.id },
        data: { ativo: false, imagensVerificadas: true },
      })
      return NextResponse.json({
        ok: true,
        aviso: 'Produto não encontrado no Tiny — marcado como inativo',
        campos: {},
      })
    }

    // Extrai imagens
    const imagens = extrairImagensTiny(detalhe)

    // Extrai outros campos
    const nome = detalhe.nome || undefined
    const descricao = detalhe.descricao_complementar || detalhe.obs || detalhe.descricao_curta || undefined
    const preco = detalhe.preco ? Number(detalhe.preco) : undefined
    const precoPromocional = detalhe.preco_promocional && Number(detalhe.preco_promocional) > 0
      ? Number(detalhe.preco_promocional)
      : null
    const categoria = detalhe.categoria?.descricao || (typeof detalhe.categoria === 'string' ? detalhe.categoria : undefined)
    const marca = detalhe.marca || undefined
    const ativo = detalhe.situacao === 'A' || detalhe.situacao === 'Ativo'

    // Busca estoque real (depósitos)
    const estoque = await fetchTinyProductEstoque(produto.tinyId)

    // Monta campos atualizados
    const campos: Record<string, any> = {
      imagensVerificadas: true,
      temImagem: imagens.length > 0,
      ativo,
      ...(nome        && { nome }),
      ...(descricao   && { descricao }),
      ...(preco       !== undefined && { preco }),
      ...(precoPromocional !== undefined && { precoPromocional }),
      ...(categoria   && { categoria }),
      ...(marca       && { marca }),
      ...(estoque >= 0 && { estoque }),
    }

    // Só atualiza imagens se encontrou alguma (evita apagar fotos existentes)
    if (imagens.length > 0) {
      campos.imagens = imagens
    }

    await prisma.product.update({
      where: { id: params.id },
      data: campos,
    })

    return NextResponse.json({
      ok: true,
      campos: {
        nome,
        preco,
        precoPromocional,
        estoque,
        imagens: imagens.length,
        categoria,
        marca,
        ativo,
        descricao: !!descricao,
      },
    })
  } catch (e: any) {
    console.error('[sync-produto]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
