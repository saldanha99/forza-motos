export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDate, formatPrice } from '@/lib/utils'
import { PageHeader, StatusPill, Card, CardHeader, EmptyState } from '@/components/admin/ui/primitives'
import { AlterarStatusPedido } from '@/components/admin/AlterarStatusPedido'
import { PedidoStepper } from '@/components/admin/PedidoStepper'
import { EtiquetaMelhorEnvio } from '@/components/admin/EtiquetaMelhorEnvio'

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
      <PageHeader
        titulo={pedido.orderNumber}
        descricao="Itens, cliente, entrega e pagamento deste pedido, com o histórico completo de movimentação."
        acoes={<StatusPill status={pedido.status} />}
      />

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
          <Card>
            <CardHeader titulo="Itens" />
            <div className="space-y-3 p-5">
              {pedido.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-brand-muted font-medium">{item.product.nome} × {item.quantidade}</span>
                  <span className="text-brand-text font-semibold">{formatPrice(Number(item.precoUnitario) * item.quantidade)}</span>
                </div>
              ))}
              <div className="border-t border-brand-hair pt-3 space-y-2 text-sm">
                <div className="flex justify-between text-brand-muted">
                  <span>Frete</span>
                  <span className="text-brand-text">{formatPrice(Number(pedido.frete))}</span>
                </div>
                {Number(pedido.desconto) > 0 && (
                  <div className="flex justify-between text-brand-success font-medium">
                    <span>Desconto</span>
                    <span>-{formatPrice(Number(pedido.desconto))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-brand-text text-base pt-1 border-t border-brand-hair">
                  <span>Total</span>
                  <span>{formatPrice(Number(pedido.total))}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Histórico de tracking */}
          <Card>
            <CardHeader titulo="Histórico" />
            <div className="p-5">
              {pedido.tracking.length === 0 ? (
                <EmptyState
                  compacto
                  titulo="Nenhum evento ainda"
                  descricao="Assim que o pedido mudar de etapa, o histórico aparece aqui."
                />
              ) : (
                <div className="space-y-4">
                  {pedido.tracking.map((t) => (
                    <div key={t.id} className="flex gap-4 text-sm border-l-2 border-brand-hair pl-4 py-0.5">
                      <span className="text-brand-dim shrink-0 font-mono text-xs">{formatDate(t.createdAt)}</span>
                      <span className="text-brand-text">{t.descricao}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Ações de status */}
          <AlterarStatusPedido pedidoId={pedido.id} statusAtual={pedido.status} freteServico={pedido.freteServico} />

          {/* Envio pelo Melhor Envio — comprar etiqueta é clique manual */}
          <EtiquetaMelhorEnvio
            pedidoId={pedido.id}
            freteServico={pedido.freteServico}
            freteTransportadora={pedido.freteTransportadora}
            melhorEnvioId={pedido.melhorEnvioId}
            melhorEnvioStatus={pedido.melhorEnvioStatus}
            melhorEnvioEtiqueta={pedido.melhorEnvioEtiqueta}
            trackingCode={pedido.trackingCode}
          />

          {/* Cliente */}
          {pedido.user && (
            <Card>
              <CardHeader titulo="Cliente" />
              <dl className="space-y-3 p-5 text-sm">
                <div>
                  <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">Nome</dt>
                  <dd className="text-brand-text font-medium mt-0.5">{pedido.user.nome}</dd>
                </div>
                <div>
                  <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">E-mail</dt>
                  <dd className="text-brand-text font-medium mt-0.5 break-all">{pedido.user.email}</dd>
                </div>
                <div>
                  <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">Telefone</dt>
                  <dd className="text-brand-text font-medium mt-0.5">{pedido.user.telefone ?? '-'}</dd>
                </div>
              </dl>
            </Card>
          )}

          {/* Entrega ou Retirada */}
          <Card>
            <CardHeader titulo={pedido.freteServico === 'retirada' ? 'Retirada na Loja' : 'Entrega'} />
            <div className="p-5">
              {pedido.freteServico === 'retirada' ? (
                <div className="text-sm text-brand-muted space-y-1">
                  <p className="text-brand-success font-semibold">Cliente optou por retirar no balcão</p>
                  <p className="text-xs text-brand-muted">Não gerar etiqueta de envio ou despacho via transportadora.</p>
                </div>
              ) : (
                <address className="text-sm text-brand-muted not-italic space-y-1">
                  <p className="text-brand-text font-medium">{endereco?.rua}, {endereco?.numero} {endereco?.complemento}</p>
                  <p>{endereco?.bairro}</p>
                  <p>{endereco?.cidade}/{endereco?.estado}</p>
                  <p className="pt-1 font-mono text-xs text-brand-dim">CEP: {endereco?.cep}</p>
                </address>
              )}
            </div>
          </Card>

          {/* Pagamento */}
          <Card>
            <CardHeader titulo="Pagamento" />
            <dl className="space-y-3 p-5 text-sm">
              <div>
                <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">Método</dt>
                <dd className="text-brand-text font-semibold mt-0.5">{pedido.pagamentoMetodo ?? '-'}</dd>
              </div>
              {pedido.pagamentoIdExterno && (
                <div>
                  <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">ID externo</dt>
                  <dd className="text-brand-muted text-xs font-mono break-all mt-0.5">{pedido.pagamentoIdExterno}</dd>
                </div>
              )}
              {pedido.olistOrderId && (
                <div>
                  <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">OLIST Order ID</dt>
                  <dd className="text-brand-muted font-mono text-xs mt-0.5">{pedido.olistOrderId}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
