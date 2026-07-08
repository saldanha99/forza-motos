import { CheckCircle2, CircleDollarSign, Cloud, PackageOpen, Truck, Home, XCircle, ShoppingBag } from 'lucide-react'
import { ReplicarOlistButton } from './ReplicarOlistButton'

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
      <div className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 mb-6">
        <XCircle size={22} className="text-red-400" />
        <p className="text-sm text-red-300 font-semibold">Pedido cancelado</p>
      </div>
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
    <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl px-5 py-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-0">
        {steps.map((s, i) => {
          const ativo = i === atual
          return (
            <div key={s.titulo} className="flex sm:flex-col sm:items-center sm:flex-1 items-start gap-3 sm:gap-2 relative">
              {/* linha conectora (desktop) */}
              {i < steps.length - 1 && (
                <span
                  className={`hidden sm:block absolute top-[15px] left-[calc(50%+18px)] right-[calc(-50%+18px)] h-0.5 rounded ${
                    s.done ? 'bg-emerald-500/50' : 'bg-brand-border/30'
                  }`}
                />
              )}
              <span
                className={`z-10 flex items-center justify-center w-8 h-8 rounded-full border shrink-0 ${
                  s.done
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                    : ativo
                      ? 'bg-brand-accent/15 border-brand-accent/60 text-brand-accent animate-pulse'
                      : 'bg-white/[0.03] border-brand-border/30 text-brand-muted/50'
                }`}
              >
                {s.done ? <CheckCircle2 size={16} /> : <s.icon size={15} />}
              </span>
              <div className="sm:text-center min-w-0">
                <p className={`text-xs font-bold ${s.done ? 'text-emerald-400' : ativo ? 'text-brand-accent' : 'text-brand-muted/60'}`}>
                  {s.titulo}
                </p>
                <p className="text-[11px] text-brand-muted/70 leading-tight mt-0.5 max-w-[120px] truncate sm:mx-auto" title={s.detalhe}>
                  {s.detalhe}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Ação urgente: pago mas não replicado */}
      {pago && !noOlist && (
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-red-500/20">
          <p className="text-xs text-red-300 flex-1 min-w-[200px]">
            ⚠️ Pagamento aprovado mas o pedido <strong>não está no Olist</strong> — sem NF e sem baixa de
            estoque no ERP. Replique agora:
          </p>
          <ReplicarOlistButton pedidoId={pedidoId} />
        </div>
      )}
    </div>
  )
}
