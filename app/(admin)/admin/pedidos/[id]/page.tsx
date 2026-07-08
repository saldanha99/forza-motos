export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDate, formatPrice } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { AlterarStatusPedido } from '@/components/admin/AlterarStatusPedido'
import { PedidoStepper } from '@/components/admin/PedidoStepper'

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
      <div className="flex items-center gap-4 mb-6">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">{pedido.orderNumber}</h1>
        {statusBadge(pedido.status)}
      </div>

      {/* Linha do tempo com próxima ação */}
      <PedidoStepper
        pedidoId={pedido.id}
        status={pedido.status}
        olistOrderId={pedido.olistOrderId}
        trackingCode={pedido.trackingCode}
        freteServico={pedido.freteServico}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Itens */}
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
            <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Itens</h2>
            <div className="space-y-3">
              {pedido.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-brand-muted font-medium">{item.product.nome} × {item.quantidade}</span>
                  <span className="text-brand-text font-semibold">{formatPrice(Number(item.precoUnitario) * item.quantidade)}</span>
                </div>
              ))}
              <div className="border-t border-brand-border/20 pt-3 space-y-2 text-sm">
                <div className="flex justify-between text-brand-muted/80">
                  <span>Frete</span>
                  <span className="text-brand-text">{formatPrice(Number(pedido.frete))}</span>
                </div>
                {Number(pedido.desconto) > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span>Desconto</span>
                    <span>-{formatPrice(Number(pedido.desconto))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-brand-text text-base pt-1 border-t border-brand-border/20">
                  <span>Total</span>
                  <span>{formatPrice(Number(pedido.total))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico de tracking */}
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
            <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Histórico</h2>
            {pedido.tracking.length === 0 ? (
              <p className="text-sm text-brand-muted/70">Nenhum evento ainda.</p>
            ) : (
              <div className="space-y-4">
                {pedido.tracking.map((t) => (
                  <div key={t.id} className="flex gap-4 text-sm border-l-2 border-brand-accent/20 pl-4 py-0.5">
                    <span className="text-brand-muted/60 shrink-0 font-mono text-xs">{formatDate(t.createdAt)}</span>
                    <span className="text-brand-text/90">{t.descricao}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Ações de status */}
          <AlterarStatusPedido pedidoId={pedido.id} statusAtual={pedido.status} freteServico={pedido.freteServico} />

          {/* Cliente */}
          {pedido.user && (
            <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
              <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Cliente</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-brand-muted text-xs font-semibold uppercase tracking-wider">Nome</dt>
                  <dd className="text-brand-text font-medium mt-0.5">{pedido.user.nome}</dd>
                </div>
                <div>
                  <dt className="text-brand-muted text-xs font-semibold uppercase tracking-wider">E-mail</dt>
                  <dd className="text-brand-text font-medium mt-0.5 break-all">{pedido.user.email}</dd>
                </div>
                <div>
                  <dt className="text-brand-muted text-xs font-semibold uppercase tracking-wider">Telefone</dt>
                  <dd className="text-brand-text font-medium mt-0.5">{pedido.user.telefone ?? '-'}</dd>
                </div>
              </dl>
            </div>
          )}

          {/* Entrega ou Retirada */}
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
            <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">
              {pedido.freteServico === 'retirada' ? 'Retirada na Loja' : 'Entrega'}
            </h2>
            {pedido.freteServico === 'retirada' ? (
              <div className="text-sm text-brand-muted/95 space-y-1">
                <p className="text-brand-text font-semibold text-emerald-400">Cliente optou por retirar no balcão</p>
                <p className="text-xs text-brand-muted/80">Não gerar etiqueta de envio ou despacho via transportadora.</p>
              </div>
            ) : (
              <address className="text-sm text-brand-muted/90 not-italic space-y-1">
                <p className="text-brand-text font-medium">{endereco?.rua}, {endereco?.numero} {endereco?.complemento}</p>
                <p>{endereco?.bairro}</p>
                <p>{endereco?.cidade}/{endereco?.estado}</p>
                <p className="pt-1 font-mono text-xs text-brand-muted/60">CEP: {endereco?.cep}</p>
              </address>
            )}
          </div>

          {/* Pagamento */}
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
            <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Pagamento</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-brand-muted text-xs font-semibold uppercase tracking-wider">Método</dt>
                <dd className="text-brand-text font-semibold mt-0.5">{pedido.pagamentoMetodo ?? '-'}</dd>
              </div>
              {pedido.pagamentoIdExterno && (
                <div>
                  <dt className="text-brand-muted text-xs font-semibold uppercase tracking-wider">ID externo</dt>
                  <dd className="text-brand-muted/80 text-xs font-mono break-all mt-0.5">{pedido.pagamentoIdExterno}</dd>
                </div>
              )}
              {pedido.olistOrderId && (
                <div>
                  <dt className="text-brand-muted text-xs font-semibold uppercase tracking-wider">OLIST Order ID</dt>
                  <dd className="text-brand-muted font-mono text-xs mt-0.5">{pedido.olistOrderId}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
