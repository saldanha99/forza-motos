import { CheckCircle2, CircleDollarSign, Cloud, PackageOpen, Truck, Home, XCircle, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, TOM_FUNDO, TOM_TEXTO } from '@/components/admin/ui/primitives'
import { ReplicarOlistButton } from './ReplicarOlistButton'

/** Classes do círculo/rótulo de cada etapa, conforme seu estado. */
function tomDoStep(done: boolean, ativo: boolean) {
  if (done) return { fundo: TOM_FUNDO.success, texto: TOM_TEXTO.success, borda: 'border-brand-success' }
  if (ativo) return { fundo: TOM_FUNDO.accent, texto: TOM_TEXTO.accent, borda: 'border-brand-accent' }
  return { fundo: 'bg-brand-surface-2', texto: 'text-brand-dim', borda: 'border-brand-border' }
}

/**
 * Linha do tempo do pedido: mostra em que etapa ele está e qual a próxima ação.
 * Pago → Olist/NF → Separação → Despacho → Entrega
 */
export function PedidoStepper({
  pedidoId,
  status,
  olistOrderId,
  trackingCode,
  freteServico,
}: {
  pedidoId: string
  status: string
  olistOrderId: string | null
  trackingCode: string | null
  freteServico: string | null
}) {
  if (status === 'CANCELADO') {
    return (
      <Card className="mb-6 flex items-center gap-3 border-brand-danger bg-brand-danger-soft px-5 py-4">
        <XCircle size={22} className="text-brand-danger" />
        <p className="text-sm font-semibold text-brand-danger">Pedido cancelado</p>
      </Card>
    )
  }

  const pago = status !== 'AGUARDANDO_PAGAMENTO'
  const noOlist = Boolean(olistOrderId)
  const separando = ['SEPARANDO', 'ENVIADO', 'ENTREGUE'].includes(status)
  const enviado = ['ENVIADO', 'ENTREGUE'].includes(status)
  const entregue = status === 'ENTREGUE'
  const isRetirada = freteServico === 'retirada'

  const steps = [
    { done: pago, icon: CircleDollarSign, titulo: 'Pagamento', detalhe: pago ? 'Aprovado' : 'Aguardando cliente pagar' },
    { done: noOlist, icon: Cloud, titulo: 'Olist / NF', detalhe: noOlist ? `Pedido no ERP` : pago ? 'NÃO replicado — agir!' : 'Replica após pagamento' },
    { done: separando, icon: PackageOpen, titulo: 'Separação', detalhe: separando ? 'Em separação/embalado' : 'Separar no painel Olist' },
    {
      done: enviado,
      icon: isRetirada ? ShoppingBag : Truck,
      titulo: isRetirada ? 'Retirada' : 'Despacho',
      detalhe: enviado
        ? (isRetirada ? 'Pronto para retirada' : (trackingCode ? `Rastreio ${trackingCode}` : 'Enviado'))
        : (isRetirada ? 'Aguardando separação' : 'Etiqueta + coleta')
    },
    {
      done: entregue,
      icon: isRetirada ? CheckCircle2 : Home,
      titulo: isRetirada ? 'Retirado' : 'Entrega',
      detalhe: entregue
        ? (isRetirada ? 'Retirado no balcão' : 'Entregue ao cliente')
        : (isRetirada ? 'Aguardando cliente retirar' : 'Aguardando transporte')
    },
  ]
  const atual = steps.findIndex((s) => !s.done)

  return (
    <Card className="mb-6 px-5 py-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-0">
        {steps.map((s, i) => {
          const ativo = i === atual
          const tom = tomDoStep(s.done, ativo)
          return (
            <div key={s.titulo} className="flex sm:flex-col sm:items-center sm:flex-1 items-start gap-3 sm:gap-2 relative">
              {/* linha conectora (desktop) */}
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    'hidden sm:block absolute top-[15px] left-[calc(50%+18px)] right-[calc(-50%+18px)] h-0.5 rounded',
                    s.done ? 'bg-brand-success' : 'bg-brand-border',
                  )}
                />
              )}
              <span
                className={cn(
                  'z-10 flex items-center justify-center w-8 h-8 rounded-full border shrink-0',
                  tom.fundo, tom.texto, tom.borda,
                  ativo && 'animate-pulse',
                )}
              >
                {s.done ? <CheckCircle2 size={16} /> : <s.icon size={15} />}
              </span>
              <div className="sm:text-center min-w-0">
                <p className={cn('text-xs font-bold', tom.texto)}>
                  {s.titulo}
                </p>
                <p className="text-[11px] text-brand-dim leading-tight mt-0.5 max-w-[120px] truncate sm:mx-auto" title={s.detalhe}>
                  {s.detalhe}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Ação urgente: pago mas não replicado */}
      {pago && !noOlist && (
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-brand-hair">
          <p className="text-xs text-brand-danger flex-1 min-w-[200px]">
            ⚠️ Pagamento aprovado mas o pedido <strong>não está no Olist</strong> — sem NF e sem baixa de
            estoque no ERP. Replique agora:
          </p>
          <ReplicarOlistButton pedidoId={pedidoId} />
        </div>
      )}
    </Card>
  )
}
