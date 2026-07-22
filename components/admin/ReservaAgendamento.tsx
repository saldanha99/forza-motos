'use client'

/**
 * Reserva de estoque de um agendamento (assessoria de estoque, Fase 1).
 * Mostra os produtos reservados e permite reservar um novo (busca + qtd).
 * Se a reserva estourar o estoque, a API alerta o grupo de WhatsApp e o card
 * mostra o aviso de conflito.
 */
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { PackageSearch, Plus, X, AlertTriangle, Loader2 } from 'lucide-react'

interface ProdutoLite { id: string; nome: string; sku: string; categoria: string }
interface Reserva {
  id: string
  quantidade: number
  produto: { id: string; nome: string; estoque: number }
  reservadoTotal: number
}

export function ReservaAgendamento({ appointmentId }: { appointmentId: string }) {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ProdutoLite[]>([])
  const [carregando, setCarregando] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function carregar() {
    const r = await fetch(`/api/admin/agendamentos/${appointmentId}/reserva`)
    if (r.ok) setReservas(await r.json())
  }
  useEffect(() => { carregar() }, [appointmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (busca.trim().length < 2) { setResultados([]); return }
    setCarregando(true)
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/produtos/buscar?q=${encodeURIComponent(busca.trim())}`)
        setResultados(await r.json())
      } finally { setCarregando(false) }
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [busca])

  async function reservar(p: ProdutoLite) {
    const r = await fetch(`/api/admin/agendamentos/${appointmentId}/reserva`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: p.id, quantidade: 1 }),
    })
    const data = await r.json()
    if (!r.ok) { toast.error(data.error || 'Erro ao reservar'); return }
    setBusca(''); setResultados([]); setAberto(false)
    await carregar()
    if (data.conflito) toast('⚠️ Conflito de estoque — grupo avisado', { icon: '⚠️' })
    else toast.success('Produto reservado')
  }

  async function cancelar(id: string) {
    const r = await fetch(`/api/admin/reservas/${id}`, { method: 'DELETE' })
    if (r.ok) setReservas((rs) => rs.filter((x) => x.id !== id))
  }

  return (
    <div className="mt-2 pt-2 border-t border-brand-border/20">
      {reservas.length > 0 && (
        <div className="space-y-1 mb-2">
          {reservas.map((r) => {
            const conflito = r.reservadoTotal > r.produto.estoque
            return (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 ${conflito ? 'text-amber-600' : 'text-brand-muted'}`}>
                  {conflito && <AlertTriangle size={12} />}
                  {r.produto.nome}
                  <span className="opacity-60">
                    (estoque {r.produto.estoque} · reservado {r.reservadoTotal})
                  </span>
                </span>
                <button onClick={() => cancelar(r.id)} className="text-brand-muted hover:text-red-500 ml-auto" title="Cancelar reserva">
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {aberto ? (
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <PackageSearch size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-brand-muted" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus
                placeholder="Buscar produto para reservar…"
                className="w-full bg-brand-bg border border-brand-line rounded-lg pl-7 pr-2 py-1.5 text-xs text-brand-text outline-none focus:border-[#d42b2b]" />
            </div>
            <button onClick={() => { setAberto(false); setBusca('') }} className="text-brand-muted hover:text-brand-text"><X size={14} /></button>
          </div>
          {(carregando || resultados.length > 0) && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-brand-line bg-brand-card">
              {carregando && <div className="p-2 text-center text-brand-muted"><Loader2 size={14} className="animate-spin inline" /></div>}
              {resultados.map((p) => (
                <button key={p.id} onClick={() => reservar(p)}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-brand-bg text-xs">
                  <span className="block text-brand-text truncate">{p.nome}</span>
                  <span className="block text-brand-muted text-[10px]">{p.sku} · {p.categoria}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#d42b2b] hover:underline">
          <Plus size={12} /> Reservar produto
        </button>
      )}
    </div>
  )
}
