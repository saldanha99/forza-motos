/**
 * POST /api/admin/pedidos/{id}/etiqueta
 *
 * Compra a etiqueta do pedido no Melhor Envio, gera o PDF e captura o rastreio.
 *
 * ⚠️ GASTA SALDO REAL da conta do Melhor Envio. Por isso é um endpoint de admin
 * acionado por clique — o pagamento aprovado só deixa o envio pronto no carrinho.
 *
 * PUT no mesmo caminho refaz apenas o passo do carrinho (útil quando o pedido
 * foi pago antes da integração, ou quando o preparo automático falhou).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adicionarPedidoAoCarrinho, comprarEtiquetaDoPedido } from '@/lib/frete/envio-me'

export const maxDuration = 60

async function exigirAdmin() {
  const session = await getServerSession(authOptions)
  return session && session.user.role === 'ADMIN'
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, melhorEnvioId: true, melhorEnvioEtiqueta: true },
  })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  // Não comprar etiqueta de pedido que não foi pago — dinheiro jogado fora
  if (order.status === 'AGUARDANDO_PAGAMENTO' || order.status === 'CANCELADO') {
    return NextResponse.json(
      { error: `Pedido está ${order.status} — não comprar etiqueta` },
      { status: 400 },
    )
  }

  try {
    // Pedido pago antes da integração não tem envio no carrinho ainda
    if (!order.melhorEnvioId) await adicionarPedidoAoCarrinho(order.id)

    const r = await comprarEtiquetaDoPedido(order.id)
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Falha ao comprar etiqueta no Melhor Envio' },
      { status: 500 },
    )
  }
}

/** Só prepara o envio no carrinho — não gasta nada. */
export async function PUT(_req: Request, { params }: { params: { id: string } }) {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const r = await adicionarPedidoAoCarrinho(params.id)
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Falha ao preparar envio no Melhor Envio' },
      { status: 500 },
    )
  }
}
