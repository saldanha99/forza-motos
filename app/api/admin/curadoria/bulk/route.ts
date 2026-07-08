import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { cat, q, estado, acao } = body

    if (acao !== 'ativar' && acao !== 'desativar') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    // Filtro base idêntico ao da página de curadoria
    const where: any = { tinyId: { not: null }, ehPai: false }
    if (cat) where.categoria = cat
    if (q) where.nome = { contains: q, mode: 'insensitive' }
    if (estado === 'loja') where.ativo = true
    if (estado === 'ocultos') where.OR = [{ ativo: false }, { ocultoManual: true }]

    // Proteção: exige que tenha alguma restrição de filtro para não afetar o banco inteiro acidentalmente
    if (!cat && !q && estado === 'todos') {
      return NextResponse.json(
        { error: 'Selecione uma categoria ou faça uma busca por nome para executar esta ação.' },
        { status: 400 }
      )
    }

    if (acao === 'desativar') {
      // 1. Produtos normais
      await prisma.product.updateMany({
        where: { ...where, fornecedor: { not: 'eurolaqui' } },
        data: {
          ocultoManual: true,
          ativo: false,
        },
      })

      // 2. Produtos Eurolaqui
      await prisma.product.updateMany({
        where: { ...where, fornecedor: 'eurolaqui' },
        data: {
          mantidoManual: false,
          estoque: 0,
          ativo: false,
        },
      })
    } else if (acao === 'ativar') {
      // 1. Produtos normais -> remove o ocultamento
      await prisma.product.updateMany({
        where: { ...where, fornecedor: { not: 'eurolaqui' } },
        data: { ocultoManual: false },
      })

      // 2. Produtos normais -> ativa apenas os que têm imagem e estoque
      await prisma.product.updateMany({
        where: {
          ...where,
          fornecedor: { not: 'eurolaqui' },
          temImagem: true,
          estoque: { gt: 0 },
        },
        data: { ativo: true },
      })

      // 3. Produtos normais -> garante que os sem estoque/imagem fiquem inativos
      await prisma.product.updateMany({
        where: {
          ...where,
          fornecedor: { not: 'eurolaqui' },
          OR: [
            { temImagem: false },
            { estoque: { lte: 0 } },
          ],
        },
        data: { ativo: false },
      })

      // 4. Produtos Eurolaqui -> define mantidoManual e estoque 999
      await prisma.product.updateMany({
        where: { ...where, fornecedor: 'eurolaqui' },
        data: {
          mantidoManual: true,
          estoque: 999,
        },
      })

      // 5. Produtos Eurolaqui -> ativa apenas os que têm imagem
      await prisma.product.updateMany({
        where: {
          ...where,
          fornecedor: 'eurolaqui',
          temImagem: true,
        },
        data: { ativo: true },
      })

      // 6. Produtos Eurolaqui -> garante inativo se sem imagem
      await prisma.product.updateMany({
        where: {
          ...where,
          fornecedor: 'eurolaqui',
          temImagem: false,
        },
        data: { ativo: false },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[curadoria/bulk]', e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
