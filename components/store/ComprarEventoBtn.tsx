'use client'

import { useState } from 'react'
import { X, ShoppingBag, Loader2 } from 'lucide-react'

interface OpcaoVaga {
  label: string
  preco: number
}

interface Props {
  slug: string
  preco: number
  titulo: string
  gratuito: boolean
  opcoesVaga?: OpcaoVaga[]
}

export function ComprarEventoBtn({ slug, preco, titulo, gratuito, opcoesVaga = [] }: Props) {
  const [aberto, setAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const temOpcoes = opcoesVaga.length > 0
  const [vagaIdx, setVagaIdx] = useState(0)
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', quantidade: '1' })

  const precoUnitario = temOpcoes ? opcoesVaga[vagaIdx].preco : preco
  // Com opções de vaga, quem define se é pago é a opção escolhida (ex.: piloto grátis, com garupa pago)
  const gratisEfetivo = precoUnitario === 0

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch(`/api/eventos/${slug}/comprar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantidade: parseInt(form.quantidade) || 1,
          ...(temOpcoes && { opcaoVagaLabel: opcoesVaga[vagaIdx].label }),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao processar inscrição')
        return
      }

      // Gratuito → redirect direto para sucesso
      if (data.gratuito) {
        window.location.href = data.redirectUrl
        return
      }

      // Pago → redirect para Mercado Pago
      if (data.init_point) {
        window.location.href = data.init_point
        return
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const qty = parseInt(form.quantidade) || 1
  const total = precoUnitario * qty

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center justify-center gap-2 w-full bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase text-sm tracking-wider px-6 py-4 rounded-xl transition-colors"
      >
        <ShoppingBag size={16} />
        {gratuito ? 'Garantir minha vaga' : 'Comprar ingresso'}
      </button>

      {/* Modal */}
      {aberto && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !loading && setAberto(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-[#1a1a2e] px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50 uppercase tracking-widest font-semibold">
                  {gratuito ? 'Inscrição gratuita' : 'Comprar ingresso'}
                </p>
                <p className="text-white font-barlow font-bold text-base leading-tight mt-0.5 line-clamp-1">{titulo}</p>
              </div>
              <button
                onClick={() => setAberto(false)}
                disabled={loading}
                className="text-white/50 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">Nome completo *</label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => update('nome', e.target.value)}
                  placeholder="Seu nome"
                  className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-3 text-sm text-[#333] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">E-mail *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-3 text-sm text-[#333] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={form.telefone}
                  onChange={(e) => update('telefone', e.target.value)}
                  placeholder="(19) 99999-9999"
                  className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-3 text-sm text-[#333] outline-none transition-colors"
                />
              </div>

              {temOpcoes && (
                <div>
                  <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">Como você vai?</label>
                  <div className="space-y-2">
                    {opcoesVaga.map((op, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                          vagaIdx === idx ? 'border-[#d42b2b] bg-red-50' : 'border-[#ddd] hover:border-[#ccc]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 text-sm text-[#333]">
                          <input
                            type="radio"
                            name="vaga"
                            checked={vagaIdx === idx}
                            onChange={() => setVagaIdx(idx)}
                            className="accent-[#d42b2b]"
                          />
                          {op.label}
                        </span>
                        {op.preco > 0 ? (
                          <span className="font-barlow font-bold text-[#d42b2b]">R$ {op.preco.toFixed(2)}</span>
                        ) : (
                          <span className="font-barlow font-bold text-emerald-600">Gratuito</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!gratisEfetivo && (
                <div>
                  <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">Quantidade de ingressos</label>
                  <select
                    value={form.quantidade}
                    onChange={(e) => update('quantidade', e.target.value)}
                    className="w-full border border-[#ddd] focus:border-[#d42b2b] rounded-xl px-4 py-3 text-sm text-[#333] outline-none transition-colors bg-white"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n} ingresso{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Resumo de valor */}
              {!gratisEfetivo && (
                <div className="bg-[#fafafa] border border-[#eee] rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-[#666] font-inter">Total</span>
                  <span className="font-barlow font-black text-xl text-[#d42b2b]">
                    R$ {total.toFixed(2)}
                  </span>
                </div>
              )}

              {erro && (
                <p className="text-red-600 text-sm font-inter text-center bg-red-50 rounded-xl px-4 py-2">{erro}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#d42b2b] hover:bg-red-700 disabled:opacity-60 text-white font-barlow font-bold uppercase text-sm tracking-wider py-4 rounded-xl transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {gratisEfetivo ? 'Confirmando...' : 'Redirecionando para pagamento...'}
                  </>
                ) : (
                  gratisEfetivo ? 'Confirmar inscrição' : `Pagar R$ ${total.toFixed(2)} no Mercado Pago`
                )}
              </button>

              {!gratisEfetivo && (
                <p className="text-center text-xs text-[#aaa] font-inter">
                  Pagamento 100% seguro via Mercado Pago · Cartão, Pix ou boleto
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}
