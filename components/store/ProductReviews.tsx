'use client'

import { useState, useEffect, useCallback } from 'react'
import { Star, ThumbsUp, Send } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Review {
  id: string
  nome: string
  nota: number
  titulo: string | null
  corpo: string
  createdAt: string
}

function Estrelas({ nota, size = 14, interativa = false, onChange }: {
  nota: number
  size?: number
  interativa?: boolean
  onChange?: (n: number) => void
}) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type={interativa ? 'button' : undefined}
          onClick={interativa ? () => onChange?.(n) : undefined}
          onMouseEnter={interativa ? () => setHover(n) : undefined}
          onMouseLeave={interativa ? () => setHover(0) : undefined}
          className={interativa ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
          style={interativa ? {} : { pointerEvents: 'none' }}
        >
          <Star
            size={size}
            className="transition-colors"
            fill={n <= (hover || nota) ? '#f59e0b' : 'none'}
            stroke={n <= (hover || nota) ? '#f59e0b' : '#d1d5db'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  )
}

function BarraDistribuicao({ reviews }: { reviews: Review[] }) {
  const total = reviews.length
  const counts = [5, 4, 3, 2, 1].map((nota) => ({
    nota,
    count: reviews.filter((r) => r.nota === nota).length,
  }))

  return (
    <div className="space-y-1.5">
      {counts.map(({ nota, count }) => (
        <div key={nota} className="flex items-center gap-2 text-xs">
          <span className="text-faint w-3 shrink-0">{nota}</span>
          <Star size={10} fill="#f59e0b" stroke="#f59e0b" className="shrink-0" />
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: total ? `${(count / total) * 100}%` : '0%',
                background: '#f59e0b',
              }}
            />
          </div>
          <span className="text-faint w-4 text-right shrink-0">{count}</span>
        </div>
      ))}
    </div>
  )
}

function FormAvaliacao({ productId, onSuccess }: { productId: string; onSuccess: () => void }) {
  const [nome,   setNome]   = useState('')
  const [nota,   setNota]   = useState(0)
  const [titulo, setTitulo] = useState('')
  const [corpo,  setCorpo]  = useState('')
  const [loading, setLoading] = useState(false)
  const [erro,   setErro]   = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!nota) { setErro('Selecione uma nota'); return }
    if (!nome.trim()) { setErro('Digite seu nome'); return }
    if (corpo.trim().length < 10) { setErro('Escreva uma avaliação mais detalhada (mínimo 10 caracteres)'); return }

    setLoading(true)
    setErro('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, nome, nota, titulo, corpo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSuccess()
      setNome(''); setNota(0); setTitulo(''); setCorpo('')
    } catch (e: any) {
      setErro(e.message || 'Erro ao enviar avaliação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {/* Nota */}
      <div>
        <label className="block text-sm font-medium text-ink mb-2">Sua nota *</label>
        <Estrelas nota={nota} size={28} interativa onChange={setNota} />
      </div>

      {/* Nome */}
      <div>
        <label className="block text-xs text-faint mb-1">Nome *</label>
        <input
          value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
          className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--vermelho)' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--line)' }}
        />
      </div>

      {/* Título opcional */}
      <div>
        <label className="block text-xs text-faint mb-1">Título (opcional)</label>
        <input
          value={titulo} onChange={(e) => setTitulo(e.target.value)}
          placeholder="Resumo da sua avaliação"
          className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--vermelho)' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--line)' }}
        />
      </div>

      {/* Corpo */}
      <div>
        <label className="block text-xs text-faint mb-1">Avaliação *</label>
        <textarea
          value={corpo} onChange={(e) => setCorpo(e.target.value)}
          rows={3}
          placeholder="Conte sua experiência com o produto..."
          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--vermelho)' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--line)' }}
        />
        <p className="text-[10px] text-faint mt-1">{corpo.length}/500 caracteres</p>
      </div>

      {erro && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{erro}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
        style={{ background: 'var(--vermelho)' }}
      >
        <Send size={14} />
        {loading ? 'Enviando...' : 'Publicar avaliação'}
      </button>
    </form>
  )
}

function CardReview({ review }: { review: Review }) {
  return (
    <div className="border border-line rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Estrelas nota={review.nota} size={13} />
            {review.titulo && (
              <span className="text-sm font-semibold text-ink">{review.titulo}</span>
            )}
          </div>
          <p className="text-sm text-dim leading-relaxed">{review.corpo}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-faint">
          <span className="font-medium text-dim">{review.nome}</span> · {formatDate(review.createdAt)}
        </p>
        <div className="flex items-center gap-1 text-xs text-faint">
          <ThumbsUp size={11} />
          Útil
        </div>
      </div>
    </div>
  )
}

export function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [media,   setMedia]   = useState(0)
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reviews?productId=${productId}`)
      const data = await res.json()
      setReviews(data.reviews ?? [])
      setMedia(data.media ?? 0)
      setTotal(data.total ?? 0)
    } catch {}
    finally { setLoading(false) }
  }, [productId])

  useEffect(() => { carregar() }, [carregar])

  function handleSuccess() {
    setShowForm(false)
    setSuccessMsg('Avaliação enviada! Obrigado pelo seu feedback.')
    carregar()
    setTimeout(() => setSuccessMsg(''), 5000)
  }

  return (
    <div className="mt-10 border-t border-[#eee] pt-8">
      <h2 className="font-barlow font-bold text-[22px] text-[#111] mb-6 tracking-[-0.3px]">
        Avaliações dos clientes
      </h2>

      {/* Resumo */}
      {!loading && (
        <div className="flex flex-col sm:flex-row gap-6 mb-8 p-5 rounded-2xl" style={{ background: '#f9f9f9', border: '1px solid #eee' }}>
          {/* Nota média */}
          <div className="flex flex-col items-center justify-center sm:border-r sm:border-[#eee] sm:pr-6 shrink-0">
            <span className="font-barlow font-black text-[56px] leading-none text-[#111] tracking-[-2px]">
              {total > 0 ? media.toFixed(1) : '—'}
            </span>
            <Estrelas nota={Math.round(media)} size={16} />
            <span className="text-xs text-[#aaa] mt-1">{total} {total === 1 ? 'avaliação' : 'avaliações'}</span>
          </div>

          {/* Distribuição por estrelas */}
          {total > 0 && (
            <div className="flex-1">
              <BarraDistribuicao reviews={reviews} />
            </div>
          )}

          {total === 0 && (
            <div className="flex-1 flex items-center">
              <p className="text-sm text-[#aaa]">Seja o primeiro a avaliar este produto!</p>
            </div>
          )}
        </div>
      )}

      {/* Sucesso */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          ✓ {successMsg}
        </div>
      )}

      {/* Botão para abrir formulário */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'transparent', border: '1.5px solid #d42b2b', color: '#d42b2b' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#d42b2b'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#d42b2b' }}
        >
          <Star size={14} />
          Escrever avaliação
        </button>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="mb-8 p-5 rounded-2xl" style={{ background: '#f9f9f9', border: '1px solid #eee' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-barlow font-bold text-[17px] text-[#111]">Escrever avaliação</h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-[#aaa] hover:text-[#333] transition-colors"
            >
              Cancelar
            </button>
          </div>
          <FormAvaliacao productId={productId} onSuccess={handleSuccess} />
        </div>
      )}

      {/* Lista de reviews */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#f0f0f0' }} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-[#aaa] text-center py-6">Nenhuma avaliação ainda.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => <CardReview key={r.id} review={r} />)}
        </div>
      )}
    </div>
  )
}
