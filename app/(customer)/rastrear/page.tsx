'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDate, formatPrice, mascaraEndereco, whatsappLink } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { MessageCircle, Package, CheckCircle, Truck, Clock } from 'lucide-react'

interface TrackingData {
  orderNumber: string
  status: string
  createdAt: string
  subtotal: number
  frete: number
  total: number
  enderecoEntrega: any
  items: { nome: string; quantidade: number; precoUnitario: number }[]
  tracking: { status: string; descricao: string; createdAt: string }[]
}

const STATUS_ICONS: Record<string, any> = {
  AGUARDANDO_PAGAMENTO: Clock,
  CONFIRMADO: CheckCircle,
  SEPARANDO: Package,
  ENVIADO: Truck,
  ENTREGUE: CheckCircle,
}

export default function RastrearPage({ searchParams }: { searchParams: { pedido?: string } }) {
  const [numeroPedido, setNumeroPedido] = useState(searchParams.pedido ?? '')
  const [loading, setLoading] = useState(false)
  const [pedido, setPedido] = useState<TrackingData | null>(null)
  const [erro, setErro] = useState('')

  async function buscarPedido(e: React.FormEvent) {
    e.preventDefault()
    if (!numeroPedido.trim()) return
    setLoading(true)
    setErro('')
    setPedido(null)

    try {
      const res = await fetch(`/api/rastrear?pedido=${encodeURIComponent(numeroPedido.trim())}`)
      if (!res.ok) throw new Error('Pedido não encontrado')
      setPedido(await res.json())
    } catch {
      setErro('Pedido não encontrado. Verifique o número e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const whatsMsg = pedido ? `Olá! Tenho uma dúvida sobre o pedido ${pedido.orderNumber}` : ''

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-grotesk font-bold text-3xl text-ink mb-1">Rastrear Pedido</h1>
        <p className="text-dim">Digite o número do pedido no formato FM-2026-0001</p>
      </div>

      <form onSubmit={buscarPedido} className="flex gap-3 mb-8">
        <Input
          value={numeroPedido}
          onChange={(e) => setNumeroPedido(e.target.value)}
          placeholder="FM-2026-0001"
          className="flex-1"
        />
        <Button type="submit" loading={loading}>Buscar</Button>
      </form>

      {erro && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm mb-6">
          {erro}
        </div>
      )}

      {pedido && (
        <div className="space-y-4">
          {/* Cabeçalho */}
          <div className="bg-card border border-line rounded-xl p-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-faint mb-1">Pedido</p>
                <p className="font-grotesk font-bold text-2xl text-ink">{pedido.orderNumber}</p>
                <p className="text-xs text-faint mt-1">Realizado em {formatDate(pedido.createdAt)}</p>
              </div>
              {statusBadge(pedido.status)}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-card border border-line rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-5">Acompanhamento</h2>
            {pedido.tracking.length === 0 ? (
              <p className="text-sm text-dim">Nenhuma atualização ainda.</p>
            ) : (
              <div className="space-y-4">
                {pedido.tracking.map((t, i) => {
                  const Icon = STATUS_ICONS[t.status] ?? Package
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 bg-[var(--vermelho-light)] border border-vermelho/20 rounded-full flex items-center justify-center">
                          <Icon size={14} className="text-vermelho" />
                        </div>
                        {i < pedido.tracking.length - 1 && <div className="w-px h-6 bg-line mt-1" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium text-ink">{t.descricao}</p>
                        <p className="text-xs text-faint mt-0.5">{formatDate(t.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Itens */}
          <div className="bg-card border border-line rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-4">Itens do pedido</h2>
            <div className="space-y-2">
              {pedido.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-dim">{item.nome} × {item.quantidade}</span>
                  <span className="text-ink font-medium">{formatPrice(Number(item.precoUnitario) * item.quantidade)}</span>
                </div>
              ))}
              <div className="border-t border-line pt-2 mt-3 space-y-1 text-sm">
                <div className="flex justify-between text-dim">
                  <span>Frete</span>
                  <span>{formatPrice(pedido.frete)}</span>
                </div>
                <div className="flex justify-between font-bold text-ink">
                  <span>Total</span>
                  <span>{formatPrice(pedido.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Endereço mascarado */}
          <div className="bg-card border border-line rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-2">Entrega</h2>
            <p className="text-sm text-dim">
              {mascaraEndereco(
                `${pedido.enderecoEntrega?.rua}, ${pedido.enderecoEntrega?.numero} – ${pedido.enderecoEntrega?.cidade}/${pedido.enderecoEntrega?.estado}`
              )}
            </p>
          </div>

          {/* WhatsApp */}
          <a
            href={whatsappLink('5519974049445', whatsMsg)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-medium transition-colors"
          >
            <MessageCircle size={18} />
            Dúvida sobre este pedido? Fale no WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
