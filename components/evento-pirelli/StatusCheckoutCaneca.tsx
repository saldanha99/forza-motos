import { prisma } from '@/lib/prisma'
import { StatusPagamentoPedido } from '@/components/store/StatusPagamentoPedido'
import { SKU_CANECA_EVENTO_PIRELLI } from '@/lib/checkout/caneca-evento-pirelli'

const TOKEN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function StatusCheckoutCaneca(props: {
  searchParams: Promise<{ token?: string }>
}) {
  const tokenRaw = (await props.searchParams).token?.trim().toLowerCase() ?? ''
  const token = TOKEN_UUID.test(tokenRaw) ? tokenRaw : null
  const pedido = token
    ? await prisma.order.findUnique({
        where: { checkoutTentativaId: token },
        select: {
          orderNumber: true,
          status: true,
          eventoPirelliVisitanteId: true,
          items: {
            where: { product: { sku: SKU_CANECA_EVENTO_PIRELLI } },
            take: 1,
            select: { id: true },
          },
        },
      })
    : null
  const pedidoDaCaneca = Boolean(
    pedido?.eventoPirelliVisitanteId && pedido.items.length === 1,
  )

  return (
    <StatusPagamentoPedido
      token={pedidoDaCaneca ? token : null}
      pedido={pedidoDaCaneca ? pedido?.orderNumber ?? null : null}
      status={pedidoDaCaneca ? pedido?.status ?? null : null}
      contexto="caneca-pirelli"
    />
  )
}
