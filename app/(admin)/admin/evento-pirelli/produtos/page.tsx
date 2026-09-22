import { prisma } from '@/lib/prisma'
import { obterEventoPirelli } from '@/lib/evento-pirelli'
import { SKU_CANECA_EVENTO_PIRELLI } from '@/lib/checkout/caneca-evento-pirelli'
import {
  ProdutosEventoPirelli,
  type PedidoEventoAdmin,
  type ProdutoEventoAdmin,
} from '@/components/evento-pirelli/ProdutosEventoPirelli'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Produtos do evento Pirelli — Forza Admin' }

function imagensValidas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is string => typeof item === 'string')
}

export default async function ProdutosEventoPirelliPage() {
  const evento = await obterEventoPirelli()
  const [produtosBanco, pedidosBanco] = await Promise.all([
    prisma.product.findMany({
      where: {
        eventoPirelliId: evento.id,
        sku: { not: SKU_CANECA_EVENTO_PIRELLI },
      },
      orderBy: [{ ordemEvento: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.order.findMany({
      where: { eventoPirelliId: evento.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { nome: true, email: true } },
        items: {
          include: { product: { select: { nome: true } } },
          orderBy: { id: 'asc' },
        },
      },
    }),
  ])

  const produtos: ProdutoEventoAdmin[] = produtosBanco.map((produto) => ({
    id: produto.id,
    nome: produto.nome,
    sku: produto.sku,
    slug: produto.slug,
    descricao: produto.descricao,
    categoria: produto.categoria,
    marca: produto.marca,
    preco: Number(produto.preco),
    precoPromocional: produto.precoPromocional == null ? null : Number(produto.precoPromocional),
    prazoEntregaDias: produto.prazoEntregaDias,
    peso: produto.peso == null ? null : Number(produto.peso),
    altura: produto.altura == null ? null : Number(produto.altura),
    largura: produto.largura == null ? null : Number(produto.largura),
    comprimento: produto.comprimento == null ? null : Number(produto.comprimento),
    imagens: imagensValidas(produto.imagens),
    ativo: produto.ativo,
    destaque: produto.destaque,
    preVenda: produto.preVenda,
    estoque: produto.estoque,
    ordemEvento: produto.ordemEvento,
    limitePorPedidoEvento: produto.limitePorPedidoEvento,
    createdAt: produto.createdAt.toISOString(),
    updatedAt: produto.updatedAt.toISOString(),
  }))

  const pedidos: PedidoEventoAdmin[] = pedidosBanco.map((pedido) => ({
    id: pedido.id,
    orderNumber: pedido.orderNumber,
    status: pedido.status,
    total: Number(pedido.total),
    createdAt: pedido.createdAt.toISOString(),
    cliente: pedido.user ? { nome: pedido.user.nome, email: pedido.user.email } : null,
    items: pedido.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      nome: item.product.nome,
      quantidade: item.quantidade,
      precoUnitario: Number(item.precoUnitario),
      preVendaSnapshot: item.preVendaSnapshot,
      prazoEntregaDiasSnapshot: item.prazoEntregaDiasSnapshot,
    })),
  }))

  return <ProdutosEventoPirelli produtos={produtos} pedidos={pedidos} />
}
