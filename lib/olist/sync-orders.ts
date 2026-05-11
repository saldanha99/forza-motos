import { olistFetch } from './client'
import { prisma } from '../prisma'

export async function replicarPedidoOlist(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, user: true },
  })

  if (!order) throw new Error('Pedido não encontrado')

  const endereco = order.enderecoEntrega as any

  const payload = {
    channel: 'loja_propria',
    reference: order.orderNumber,
    shipping: {
      recipient: {
        name: order.user?.nome ?? endereco.nome ?? '',
        phone: order.user?.telefone ?? '',
        email: order.user?.email ?? '',
      },
      address: {
        street: endereco.rua,
        number: endereco.numero,
        complement: endereco.complemento,
        district: endereco.bairro,
        city: endereco.cidade,
        state: endereco.estado,
        zip_code: endereco.cep?.replace(/\D/g, ''),
        country: 'BRA',
      },
    },
    items: order.items.map((item) => ({
      sku: item.product.sku,
      name: item.product.nome,
      quantity: item.quantidade,
      unit_price: Number(item.precoUnitario),
    })),
    totals: {
      subtotal: Number(order.subtotal),
      shipping: Number(order.frete),
      discount: Number(order.desconto),
      total: Number(order.total),
    },
  }

  const result = await olistFetch('/orders/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  await prisma.order.update({
    where: { id: orderId },
    data: { olistOrderId: String(result.id) },
  })

  return result
}
