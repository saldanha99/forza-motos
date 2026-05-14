export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDate, formatPrice } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { AlterarStatusPedido } from '@/components/admin/AlterarStatusPedido'

export default async function PedidoDetalhePage({ params }: { params: { id: string } }) {
  const pedido = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      items: { include: { product: true } },
      tracking: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!pedido) notFound()

  const endereco = pedido.enderecoEntrega as any

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="font-rajdhani font-bold text-3xl text-white">{pedido.orderNumber}</h1>
        {statusBadge(pedido.status)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Itens */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h2 className="font-rajdhani font-semibold text-lg text-white mb-4">Itens</h2>
            <div className="space-y-3">
              {pedido.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-zinc-400">{item.product.nome} × {item.quantidade}</span>
                  <span className="text-white">{formatPrice(Number(item.precoUnitario) * item.quantidade)}</span>
                </div>
              ))}
              <div className="border-t border-zinc-800 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-zinc-500">
                  <span>Frete</span>
                  <span>{formatPrice(Number(pedido.frete))}</span>
                </div>
                {Number(pedido.desconto) > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Desconto</span>
                    <span>-{formatPrice(Number(pedido.desconto))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-white text-base">
                  <span>Total</span>
                  <span>{formatPrice(Number(pedido.total))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico de tracking */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h2 className="font-rajdhani font-semibold text-lg text-white mb-4">Histórico</h2>
            {pedido.tracking.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum evento ainda.</p>
            ) : (
              <div className="space-y-3">
                {pedido.tracking.map((t) => (
                  <div key={t.id} className="flex gap-3 text-sm">
                    <span className="text-zinc-600 shrink-0">{formatDate(t.createdAt)}</span>
                    <span className="text-zinc-400">{t.descricao}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Ações de status */}
          <AlterarStatusPedido pedidoId={pedido.id} statusAtual={pedido.status} />

          {/* Cliente */}
          {pedido.user && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <h2 className="font-rajdhani font-semibold text-lg text-white mb-3">Cliente</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-zinc-600 text-xs">Nome</dt>
                  <dd className="text-white">{pedido.user.nome}</dd>
                </div>
                <div>
                  <dt className="text-zinc-600 text-xs">E-mail</dt>
                  <dd className="text-white">{pedido.user.email}</dd>
                </div>
                <div>
                  <dt className="text-zinc-600 text-xs">Telefone</dt>
                  <dd className="text-white">{pedido.user.telefone ?? '-'}</dd>
                </div>
              </dl>
            </div>
          )}

          {/* Endereço */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h2 className="font-rajdhani font-semibold text-lg text-white mb-3">Entrega</h2>
            <address className="text-sm text-zinc-400 not-italic space-y-1">
              <p>{endereco?.rua}, {endereco?.numero} {endereco?.complemento}</p>
              <p>{endereco?.bairro}</p>
              <p>{endereco?.cidade}/{endereco?.estado}</p>
              <p>CEP: {endereco?.cep}</p>
            </address>
          </div>

          {/* Pagamento */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h2 className="font-rajdhani font-semibold text-lg text-white mb-3">Pagamento</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-zinc-600 text-xs">Método</dt>
                <dd className="text-white">{pedido.pagamentoMetodo ?? '-'}</dd>
              </div>
              {pedido.pagamentoIdExterno && (
                <div>
                  <dt className="text-zinc-600 text-xs">ID externo</dt>
                  <dd className="text-zinc-400 text-xs break-all">{pedido.pagamentoIdExterno}</dd>
                </div>
              )}
              {pedido.olistOrderId && (
                <div>
                  <dt className="text-zinc-600 text-xs">OLIST Order ID</dt>
                  <dd className="text-zinc-400">{pedido.olistOrderId}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
