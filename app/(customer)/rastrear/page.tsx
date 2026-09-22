'use client'

import { useState, use } from 'react';
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate, whatsappLink } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import {
  MessageCircle, Package, CheckCircle, Truck, Clock,
  Copy, Check, ExternalLink, MapPin, ShoppingBag,
  Search
} from 'lucide-react'

interface TrackingData {
  orderNumber: string
  status: string
  createdAt: string
  freteServico: string | null
  freteTransportadora: string | null
  fretePrazo: number | null
  trackingCode: string | null
  tracking: { status: string; descricao: string; createdAt: string }[]
}

const STATUS_ORDER: Record<string, number> = {
  AGUARDANDO_PAGAMENTO: 0,
  CONFIRMADO: 1,
  SEPARANDO: 2,
  ENVIADO: 3,
  ENTREGUE: 4,
  CANCELADO: -1,
}

function getStatusSteps(freteServico: string | null) {
  const isRetirada = freteServico === 'retirada'
  return [
    { key: 'AGUARDANDO_PAGAMENTO', label: 'Aguardando pagamento', Icon: Clock },
    { key: 'CONFIRMADO',           label: 'Pedido confirmado',    Icon: CheckCircle },
    { key: 'SEPARANDO',            label: 'Separando',            Icon: Package },
    { key: 'ENVIADO',              label: isRetirada ? 'Pronto para retirada' : 'Enviado',              Icon: isRetirada ? ShoppingBag : Truck },
    { key: 'ENTREGUE',             label: isRetirada ? 'Retirado' : 'Entregue',             Icon: CheckCircle },
  ]
}

// ── Barra de progresso visual ──────────────────────────────────────────────────
function BarraProgresso({ status, freteServico }: { status: string; freteServico: string | null }) {
  const idx = STATUS_ORDER[status] ?? 0
  const cancelado = status === 'CANCELADO'
  const steps = getStatusSteps(freteServico)

  return (
    <div className="flex items-center gap-0 py-2">
      {steps.map(({ key, label, Icon }, i) => {
        const done    = !cancelado && i < idx
        const current = !cancelado && i === idx

        return (
          <div key={key} className="flex items-center" style={{ flex: i < steps.length - 1 ? '1' : 'none' }}>
            {/* Círculo */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all"
                style={
                  cancelado ? { background: '#f3f4f6', border: '2px solid #e5e7eb' }
                  : done    ? { background: '#16a34a', border: '2px solid #16a34a' }
                  : current ? { background: '#d42b2b', border: '2px solid #d42b2b', boxShadow: '0 0 0 3px rgba(212,43,43,0.15)' }
                  : { background: 'var(--surface)', border: '2px solid var(--line)' }
                }
              >
                <Icon
                  size={14}
                  className={
                    done ? 'text-white'
                    : current ? 'text-white'
                    : 'text-faint'
                  }
                />
              </div>
              <span
                className="text-[9px] sm:text-[10px] text-center leading-tight max-w-[60px] hidden sm:block"
                style={{
                  color: current ? '#d42b2b' : done ? '#16a34a' : 'var(--faint)',
                  fontWeight: current ? 600 : 400,
                }}
              >
                {label}
              </span>
            </div>

            {/* Linha conectora */}
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-1 rounded-full transition-all"
                style={{
                  background: !cancelado && i < idx
                    ? '#16a34a'
                    : 'var(--line)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Código de rastreio com botão copiar ────────────────────────────────────────
function dadosRastreio(codigo: string, transportadora: string | null) {
  const nome = transportadora?.trim() || 'Transportadora'
  const chave = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const codigoUrl = encodeURIComponent(codigo)

  if (chave.includes('correios')) {
    return {
      nome: 'Correios',
      url: `https://rastreamento.correios.com.br/app/index.php?objetos=${codigoUrl}`,
    }
  }
  if (chave.includes('jadlog')) {
    return {
      nome: 'Jadlog',
      url: `https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=${codigoUrl}`,
    }
  }
  if (chave.includes('total')) {
    return {
      nome: 'Total Express',
      url: `https://totalconecta.totalexpress.com.br/rastreamento?codigo=${codigoUrl}&language=pt-br`,
    }
  }

  // Demais serviços do Melhor Envio usam o rastreador multi-transportadora.
  return {
    nome,
    url: `https://www.melhorrastreio.com.br/rastreio/${codigoUrl}`,
  }
}

function CodigoRastreio({ codigo, transportadora }: { codigo: string; transportadora: string | null }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  const rastreio = dadosRastreio(codigo, transportadora)

  return (
    <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.20)' }}>
      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-1.5">
        <Truck size={12} />
        Código de rastreio — {rastreio.nome}
      </p>
      <div className="flex items-center gap-2">
        <code
          className="flex-1 font-mono text-base sm:text-lg font-bold tracking-wider text-ink px-3 py-2 rounded-lg"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', letterSpacing: '0.1em' }}
        >
          {codigo}
        </code>
        <button
          onClick={copiar}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: copiado ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.06)',
            color: copiado ? '#16a34a' : 'var(--dim)',
            border: copiado ? '1px solid rgba(34,197,94,0.30)' : '1px solid rgba(0,0,0,0.10)',
          }}
        >
          {copiado ? <Check size={13} /> : <Copy size={13} />}
          {copiado ? 'Copiado!' : 'Copiar'}
        </button>
        <a
          href={rastreio.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'rgba(212,43,43,0.08)', color: '#d42b2b', border: '1px solid rgba(212,43,43,0.15)' }}
        >
          <ExternalLink size={13} />
          <span className="hidden sm:inline">Rastrear</span>
        </a>
      </div>
      <p className="text-[10px] text-faint mt-2">
        Abra o rastreamento correspondente à transportadora deste pedido
      </p>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function RastrearPage(props: { searchParams: Promise<{ pedido?: string }> }) {
  const searchParams = use(props.searchParams);
  const [numeroPedido, setNumeroPedido] = useState(searchParams.pedido ?? '')
  const [verificacao, setVerificacao] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [pedido,   setPedido]   = useState<TrackingData | null>(null)
  const [erro,     setErro]     = useState('')

  async function buscarPedidoDirectly(num: string) {
    setLoading(true)
    setErro('')
    setPedido(null)
    try {
      const res = await fetch('/api/rastrear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: num.trim(), verificacao: verificacao.trim() }),
      })
      if (!res.ok) throw new Error('Pedido não encontrado ou dados não conferem')
      setPedido(await res.json())
    } catch {
      setErro('Pedido não encontrado ou os dados informados não conferem.')
    } finally {
      setLoading(false)
    }
  }

  async function buscarPedido(e: React.FormEvent) {
    e.preventDefault()
    if (!numeroPedido.trim() || !verificacao.trim()) {
      setErro('Informe o número do pedido e o e-mail ou CPF usado na compra.')
      return
    }
    buscarPedidoDirectly(numeroPedido)
  }

  const whatsMsg = pedido ? `Olá! Tenho uma dúvida sobre o pedido ${pedido.orderNumber}` : ''

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-grotesk font-bold text-3xl text-ink mb-1">Rastrear Pedido</h1>
        <p className="text-dim text-sm">Informe o pedido e confirme o e-mail ou CPF usado na compra</p>
      </div>

      {/* Form de busca */}
      <form onSubmit={buscarPedido} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 mb-8">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <Input
            value={numeroPedido}
            onChange={(e) => setNumeroPedido(e.target.value)}
            placeholder="FM-2026-0001"
            className="pl-9"
          />
        </div>
        <Input
          value={verificacao}
          onChange={(e) => setVerificacao(e.target.value)}
          placeholder="E-mail ou CPF da compra"
          autoComplete="email"
        />
        <Button type="submit" loading={loading}>Buscar</Button>
      </form>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm mb-6 flex items-center gap-2">
          <span className="text-lg">😕</span>
          {erro}
        </div>
      )}

      {/* Resultado */}
      {pedido && (
        <div className="space-y-4">

          {/* Card principal — número + status */}
          <div className="bg-card border border-line rounded-2xl p-5 sm:p-6">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
              <div>
                <p className="text-xs text-faint mb-1 flex items-center gap-1">
                  <ShoppingBag size={11} />
                  Número do pedido
                </p>
                <p className="font-grotesk font-bold text-2xl text-ink tracking-tight">{pedido.orderNumber}</p>
                <p className="text-xs text-faint mt-1">Realizado em {formatDate(pedido.createdAt)}</p>
              </div>
              <div>{statusBadge(pedido.status)}</div>
            </div>

            {/* Barra de progresso */}
            {pedido.status !== 'CANCELADO' && (
              <BarraProgresso status={pedido.status} freteServico={pedido.freteServico} />
            )}

            {/* Label mobile atual */}
            <p className="text-xs text-center text-vermelho font-medium mt-2 sm:hidden">
              {getStatusSteps(pedido.freteServico).find((s) => s.key === pedido.status)?.label ?? pedido.status}
            </p>

            {/* Código de rastreio */}
            {pedido.trackingCode && (
              <CodigoRastreio
                codigo={pedido.trackingCode}
                transportadora={pedido.freteTransportadora}
              />
            )}
          </div>

          {/* Timeline de eventos */}
          <div className="bg-card border border-line rounded-2xl p-5">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-5 flex items-center gap-2">
              <Truck size={15} className="text-vermelho" />
              Histórico de atualizações
            </h2>
            {pedido.tracking.length === 0 ? (
              <p className="text-sm text-dim py-2">Nenhuma atualização disponível ainda.</p>
            ) : (
              <div className="space-y-0">
                {[...pedido.tracking].reverse().map((t, i) => {
                  const StepIcon = getStatusSteps(pedido.freteServico).find((s) => s.key === t.status)?.Icon ?? Package
                  const isFirst = i === 0
                  const isLast  = i === pedido.tracking.length - 1
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={
                            isFirst
                              ? { background: 'rgba(212,43,43,0.10)', border: '1.5px solid rgba(212,43,43,0.30)' }
                              : { background: 'var(--surface)', border: '1.5px solid var(--line)' }
                          }
                        >
                          <StepIcon size={14} className={isFirst ? 'text-vermelho' : 'text-faint'} />
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-line my-1 min-h-[20px]" />}
                      </div>
                      <div className="pb-5">
                        <p className={`text-sm font-medium ${isFirst ? 'text-ink' : 'text-dim'}`}>{t.descricao}</p>
                        <p className="text-xs text-faint mt-0.5">{formatDate(t.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* O endereço da loja é público; endereço do cliente nunca vem da API. */}
          {pedido.freteServico === 'retirada' && (
            <div className="bg-card border border-line rounded-2xl p-5">
              <h2 className="font-grotesk font-semibold text-base text-ink mb-2 flex items-center gap-2">
                <MapPin size={15} className="text-vermelho" />
                Local de Retirada
              </h2>
              <p className="text-sm text-dim leading-relaxed">
                <strong className="text-ink">Forza Motos</strong>
                <br />
                Rua Funilense, 110 — Guanabara
                <br />
                Campinas/SP — CEP: 13073-041
                <br />
                <span className="text-xs text-faint mt-1.5 block font-semibold text-emerald-600 dark:text-emerald-400">
                  🏁 Disponível para retirada de Segunda a Sexta das 9h às 18h e Sábado das 8h às 12h.
                </span>
              </p>
            </div>
          )}

          {/* WhatsApp CTA */}
          <a
            href={whatsappLink('5519974049445', whatsMsg)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold transition-colors text-white text-sm"
            style={{ background: '#25d366' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#1db954' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#25d366' }}
          >
            <MessageCircle size={18} />
            Dúvida sobre este pedido? Fale no WhatsApp
          </a>
        </div>
      )}

      {/* Estado vazio (sem busca ainda) */}
      {!pedido && !erro && !loading && (
        <div className="text-center py-12 text-faint">
          <Package size={40} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm">Digite o número do pedido para começar</p>
          <p className="text-xs mt-1 opacity-70">Formato: FM-2026-0001</p>
        </div>
      )}
    </div>
  )
}
