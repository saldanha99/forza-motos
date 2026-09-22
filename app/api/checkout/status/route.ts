import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reconciliarCheckout } from '@/lib/checkout/reconciliacao'
import { consumirRateLimitStatusCheckout } from '@/lib/checkout/status-rate-limit'

export const dynamic = 'force-dynamic'

const TOKEN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')?.trim().toLowerCase() ?? ''
  if (!TOKEN_UUID.test(token)) {
    return NextResponse.json({ error: 'Consulta inválida' }, { status: 400 })
  }
  if (!(await consumirRateLimitStatusCheckout(req, token))) {
    return NextResponse.json({ error: 'Aguarde antes de consultar novamente' }, { status: 429 })
  }

  const pedido = await prisma.order.findUnique({
    where: { checkoutTentativaId: token },
    select: { id: true },
  })
  if (!pedido) return NextResponse.json({ error: 'Pedido não localizado' }, { status: 404 })

  // Busca uma aprovação oficial mesmo antes da reserva vencer. A mesma
  // máquina idempotente do webhook confirma e dispara as outboxes.
  await reconciliarCheckout({}, { orderIds: [pedido.id], limite: 1 })

  const atual = await prisma.order.findUniqueOrThrow({
    where: { id: pedido.id },
    select: {
      orderNumber: true,
      status: true,
      notificacoesAgendadasEm: true,
    },
  })
  return NextResponse.json({
    pedido: atual.orderNumber,
    status: atual.status,
    notificacoesAgendadas: Boolean(atual.notificacoesAgendadasEm),
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
