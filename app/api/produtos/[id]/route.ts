import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolverPublicacaoProduto } from '@/lib/produtos/publicacao'

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const current = await prisma.product.findUnique({
    where: { id: params.id },
    select: { imagens: true, estoque: true, ativo: true, preVenda: true, eventoPirelliId: true }
  })

  if (!current) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }
  if (current.eventoPirelliId) {
    return NextResponse.json({
      error: 'Produto exclusivo do evento. Edite pela área Produtos do Evento Pirelli.',
    }, { status: 409 })
  }

  const body = await req.json()

  const rawImagens = body.imagens !== undefined ? body.imagens : current.imagens
  const imagens = Array.isArray(rawImagens) ? rawImagens : []
  const temImagem = imagens.length > 0

  const estoque = body.estoque !== undefined ? Number(body.estoque) : current.estoque
  const preVenda = body.preVenda !== undefined ? body.preVenda === true : current.preVenda

  const alterouPublicacao = body.ativo !== undefined
  const requestedAtivo = alterouPublicacao ? body.ativo === true : current.ativo
  const publicacao = resolverPublicacaoProduto({
    ativoSolicitado: requestedAtivo,
    temImagem,
    estoque,
    preVenda,
  })

  const produto = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...body,
      preco: body.preco !== undefined ? Number(body.preco) : undefined,
      precoPromocional: body.precoPromocional !== undefined
        ? (body.precoPromocional ? Number(body.precoPromocional) : null)
        : undefined,
      estoque,
      temImagem,
      ativo: publicacao.ativo,
      // O mesmo controle do formulário passa a comandar a visibilidade real.
      // Sem isso, era possível ficar "Ativo" e ainda oculto da loja.
      ocultoManual: alterouPublicacao ? publicacao.ocultoManual : undefined,
      preVenda,
      prazoEntregaDias: body.prazoEntregaDias !== undefined
        ? (body.prazoEntregaDias ? Number(body.prazoEntregaDias) : null)
        : undefined,
    },
  })

  return NextResponse.json(produto)
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const produto = await prisma.product.findUnique({
    where: { id: params.id },
    select: { eventoPirelliId: true },
  })
  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  if (produto.eventoPirelliId) {
    return NextResponse.json({
      error: 'Produto exclusivo do evento. Arquive pela área Produtos do Evento Pirelli.',
    }, { status: 409 })
  }

  await prisma.product.update({
    where: { id: params.id },
    data: { ativo: false, ocultoManual: true },
  })

  return NextResponse.json({ ok: true })
}
