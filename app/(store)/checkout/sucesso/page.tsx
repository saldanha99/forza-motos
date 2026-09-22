export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { StatusPagamentoPedido } from '@/components/store/StatusPagamentoPedido'

const TOKEN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function CheckoutSucessoPage(props: {
  searchParams: Promise<{ token?: string }>
}) {
  const tokenRaw = (await props.searchParams).token?.trim().toLowerCase() ?? ''
  const token = TOKEN_UUID.test(tokenRaw) ? tokenRaw : null
  const pedido = token
    ? await prisma.order.findUnique({
        where: { checkoutTentativaId: token },
        select: { orderNumber: true, status: true },
      })
    : null

  return (
    <StatusPagamentoPedido
      token={token}
      pedido={pedido?.orderNumber ?? null}
      status={pedido?.status ?? null}
    />
  )
}
