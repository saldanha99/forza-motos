'use client'

import { useState, useRef } from 'react'
import { Truck, Gift, Zap, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { calcularRegrasFrete, faltaParaFreteGratis } from '@/lib/frete/regras'
import { formatPrice } from '@/lib/utils'

interface Props {
  subtotal: number           // subtotal do carrinho ou preço do produto
  compact?: boolean          // modo compacto (produto) vs expandido (carrinho)
}

export function CalculadorFrete({ subtotal, compact = false }: Props) {
  const [cep,     setCep]     = useState('')
  const [estado,  setEstado]  = useState('')
  const [cidade,  setCidade]  = useState('')
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState('')
  const [aberto,  setAberto]  = useState(!compact)

  const inputRef = useRef<HTMLInputElement>(null)

  async function buscarCEP(raw: string) {
    const cepLimpo = raw.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return
    setLoading(true)
    setErro('')
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const d = await r.json()
      if (d.erro) { setErro('CEP não encontrado'); return }
      setEstado(d.uf)
      setCidade(d.localidade)
    } catch {
      setErro('Erro ao buscar CEP. Verifique e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Máscara 00000-000
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
    const mask = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw
    setCep(mask)
    setEstado('')
    setCidade('')
    setErro('')
    if (raw.length === 8) buscarCEP(raw)
  }

  const opcoes = estado ? calcularRegrasFrete(estado, subtotal) : []
  const falta  = estado ? faltaParaFreteGratis(estado, subtotal) : null

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--line)' }}>

      {/* Header clicável (só no modo compact) */}
      {compact ? (
        <button
          onClick={() => setAberto((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--ink)' }}
        >
          <span className="flex items-center gap-2">
            <Truck size={14} className="text-vermelho shrink-0" />
            Calcular frete
          </span>
          {aberto ? <ChevronUp size={14} className="text-faint" /> : <ChevronDown size={14} className="text-faint" />}
        </button>
      ) : (
        <div
          className="flex items-center gap-2 px-4 py-3 text-sm font-semibold"
          style={{ background: 'var(--surface)', color: 'var(--ink)', borderBottom: '1px solid var(--line)' }}
        >
          <Truck size={14} className="text-vermelho" />
          Calcular frete
        </div>
      )}

      {/* Corpo */}
      {aberto && (
        <div className="px-4 py-3 space-y-3" style={{ background: 'var(--card)' }}>

          {/* Input CEP */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={cep}
                onChange={handleChange}
                placeholder="00000-000"
                maxLength={9}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
                onFocus={(e)  => { e.currentTarget.style.borderColor = 'var(--vermelho)' }}
                onBlur={(e)   => { e.currentTarget.style.borderColor = 'var(--line)' }}
              />
              {loading && (
                <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-faint" />
              )}
            </div>
            <a
              href="https://buscacepinter.correios.com.br/app/endereco/index.php"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0"
              style={{ background: 'var(--surface)', color: 'var(--dim)', border: '1px solid var(--line)' }}
            >
              Não sei meu CEP
            </a>
          </div>

          {/* Erro */}
          {erro && (
            <p className="text-xs text-red-500">{erro}</p>
          )}

          {/* Banner frete grátis */}
          {falta !== null && falta > 0 && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)', color: '#15803d' }}
            >
              <Gift size={12} className="shrink-0" />
              Falta <strong className="mx-1">{formatPrice(falta)}</strong> para frete grátis para SP!
            </div>
          )}

          {/* Cidade/Estado detectados */}
          {cidade && estado && (
            <p className="text-xs text-faint">
              📍 {cidade} — {estado}
            </p>
          )}

          {/* Opções de frete */}
          {opcoes.length > 0 && (
            <div className="space-y-2">
              {opcoes.map((op) => (
                <div
                  key={op.codigo}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{
                    background: op.gratis ? 'rgba(34,197,94,0.06)' : 'var(--surface)',
                    border: `1px solid ${op.gratis ? 'rgba(34,197,94,0.20)' : 'var(--line)'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    {op.gratis
                      ? <Gift size={13} className="text-green-500 shrink-0" />
                      : op.prazo <= 3
                      ? <Zap size={13} className="text-amber-500 shrink-0" />
                      : <Truck size={13} className="text-faint shrink-0" />
                    }
                    <div>
                      <p className="text-sm font-semibold text-ink leading-none">{op.servico}</p>
                      <p className="text-[10px] text-faint mt-0.5">Prazo: até {op.prazo} dias úteis</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ml-3 ${op.gratis ? 'text-green-600' : 'text-ink'}`}>
                    {op.valor === 0 ? 'Grátis 🎉' : formatPrice(op.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
