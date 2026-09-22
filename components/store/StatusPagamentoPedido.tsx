'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LimparCarrinhoAposPagamento } from '@/components/store/LimparCarrinhoAposPagamento'

type Estado = { pedido: string | null; status: string | null }
type ContextoPagamento = 'pedido' | 'caneca-pirelli'

const PAGOS = ['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE']

export function StatusPagamentoPedido(props: Estado & { token: string | null; contexto?: ContextoPagamento }) {
  const [estado, setEstado] = useState<Estado>({ pedido: props.pedido, status: props.status })
  const canecaPirelli = props.contexto === 'caneca-pirelli'

  useEffect(() => {
    if (!props.token || !estado.status || estado.status !== 'AGUARDANDO_PAGAMENTO') return
    let cancelado = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let consultando = false

    const agendar = () => {
      if (cancelado) return
      const intervalo = document.visibilityState === 'visible' ? 5_000 : 30_000
      timer = setTimeout(consultar, intervalo)
    }

    const consultar = async () => {
      if (cancelado || consultando) return
      consultando = true
      let continuar = true
      try {
        const resposta = await fetch(`/api/checkout/status?token=${encodeURIComponent(props.token!)}`, {
          cache: 'no-store',
        })
        if (resposta.ok) {
          const atual = await resposta.json()
          if (!cancelado) setEstado({ pedido: atual.pedido, status: atual.status })
          if (atual.status !== 'AGUARDANDO_PAGAMENTO') continuar = false
        }
      } catch {
        // Falha transitória: o webhook/cron continuam trabalhando.
      } finally {
        consultando = false
      }
      if (continuar) agendar()
    }

    const aoMudarVisibilidade = () => {
      if (document.visibilityState !== 'visible' || cancelado || consultando) return
      if (timer) clearTimeout(timer)
      void consultar()
    }

    void consultar()
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => {
      cancelado = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    }
  }, [props.token, estado.status])

  const confirmado = Boolean(estado.status && PAGOS.includes(estado.status))
  const cancelado = estado.status === 'CANCELADO'
  const indisponivel = !props.token || !estado.status
  const Icone = confirmado ? CheckCircle : (cancelado || indisponivel) ? AlertCircle : Clock3
  const titulo = indisponivel
    ? 'Não foi possível consultar o pedido'
    : confirmado
    ? 'Pagamento confirmado!'
    : cancelado
      ? 'Pagamento não concluído'
      : 'Confirmando seu pagamento'
  const descricao = indisponivel
    ? canecaPirelli
      ? 'Volte ao checkout da caneca. Se você recebeu um número de pedido, também pode consultá-lo no rastreador.'
      : 'Volte ao checkout ou consulte a compra pelo rastreador usando o número do pedido.'
    : confirmado
    ? canecaPirelli
      ? 'Sua caneca está paga e entrou na fila de personalização com o nome escolhido no checkout. A confirmação por e-mail e WhatsApp já foi acionada.'
      : 'Seu pedido foi confirmado. A confirmação por e-mail e WhatsApp já foi acionada.'
    : cancelado
      ? 'O pedido foi cancelado. Se houve débito, o estorno será acompanhado pela nossa equipe.'
      : 'Estamos consultando o Mercado Pago automaticamente. Não refaça a compra; esta tela muda assim que a aprovação chegar.'

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      {confirmado && !canecaPirelli && <LimparCarrinhoAposPagamento />}
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
        confirmado ? 'bg-green-100 dark:bg-green-900/30' : (cancelado || indisponivel)
          ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
      }`}>
        <Icone size={40} className={
          confirmado ? 'text-green-600' : (cancelado || indisponivel) ? 'text-red-600' : 'text-amber-600'
        } />
      </div>
      <h1 className="font-grotesk font-bold text-3xl text-ink mb-3">{titulo}</h1>
      {estado.pedido && (
        <p className="text-dim mb-2">
          Número do pedido: <strong className="text-ink font-mono">{estado.pedido}</strong>
        </p>
      )}
      <p className="text-faint text-sm mb-10 leading-relaxed">{descricao}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {estado.pedido && confirmado && (
          <Link href={`/rastrear?pedido=${encodeURIComponent(estado.pedido)}`}>
            <Button variant="surface">Acompanhar pedido</Button>
          </Link>
        )}
        <Link href={canecaPirelli ? (cancelado ? '/evento-pirelli/caneca' : '/evento-pirelli') : (cancelado ? '/checkout' : '/produtos')}>
          <Button>{cancelado ? 'Tentar novamente' : canecaPirelli ? 'Voltar à experiência' : 'Continuar comprando'}</Button>
        </Link>
      </div>
    </div>
  )
}
