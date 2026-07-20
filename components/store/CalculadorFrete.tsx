'use client'

import { useState, useRef } from 'react'
import { Truck, Gift, Zap, ChevronDown, ChevronUp, Loader2, ExternalLink } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface OpcaoFrete {
  id:             string
  nome:           string
  transportadora: string
  logo?:          string
  preco:          number
  prazo:          number
}

interface Props {
  subtotal: number     // subtotal do carrinho ou preço do produto
  compact?: boolean    // modo acordeão (produto) vs expandido (carrinho)
}

export function CalculadorFrete({ subtotal, compact = false }: Props) {
  const [cep,     setCep]     = useState('')
  const [cidade,  setCidade]  = useState('')
  const [estado,  setEstado]  = useState('')
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState('')
  const [opcoes,  setOpcoes]  = useState<OpcaoFrete[]>([])
  const [aberto,  setAberto]  = useState(!compact)

  const inputRef = useRef<HTMLInputElement>(null)

  async function calcular(cepLimpo: string) {
    setLoading(true)
    setErro('')
    setOpcoes([])
    try {
      // Busca cidade/estado pelo ViaCEP
      const viaCep = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const local  = await viaCep.json()
      if (local.erro) { setErro('CEP não encontrado'); setLoading(false); return }
      setCidade(local.localidade)
      setEstado(local.uf)

      // Cotação real via Melhor Envio (server-side) — sem cache: valores sempre atuais
      const res  = await fetch(`/api/frete/calcular?cep=${cepLimpo}&subtotal=${subtotal}`, { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Erro ao calcular frete')
      setOpcoes(data.opcoes ?? [])
    } catch (e: any) {
      setErro(e.message || 'Não foi possível calcular o frete. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw  = e.target.value.replace(/\D/g, '').slice(0, 8)
    const mask = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw
    setCep(mask)
    setCidade(''); setEstado(''); setOpcoes([]); setErro('')
    if (raw.length === 8) calcular(raw)
  }

  const isExpresso = (nome: string) =>
    /sedex|express|rapid/i.test(nome)

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--line)' }}>

      {/* Header */}
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
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--vermelho)' }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = 'var(--line)' }}
              />
              {loading && (
                <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-faint" />
              )}
            </div>
            <a
              href="https://buscacepinter.correios.com.br/app/endereco/index.php"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0"
              style={{ background: 'var(--surface)', color: 'var(--dim)', border: '1px solid var(--line)' }}
            >
              <ExternalLink size={11} />
              Não sei
            </a>
          </div>

          {/* Erro */}
          {erro && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{erro}</p>
          )}

          {/* Cidade detectada */}
          {cidade && estado && !loading && (
            <p className="text-xs text-faint flex items-center gap-1">
              📍 {cidade} — {estado}
            </p>
          )}

          {/* Opções de frete */}
          {opcoes.length > 0 && (
            <div className="space-y-2">
              {opcoes.map((op) => {
                const gratis   = op.preco === 0
                const expresso = isExpresso(op.nome)
                return (
                  <div
                    key={op.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5"
                    style={{
                      background: gratis ? 'rgba(34,197,94,0.06)' : 'var(--surface)',
                      border: `1px solid ${gratis ? 'rgba(34,197,94,0.20)' : 'var(--line)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {gratis
                        ? <Gift size={13} className="text-green-500 shrink-0" />
                        : expresso
                        ? <Zap  size={13} className="text-amber-500 shrink-0" />
                        : <Truck size={13} className="text-faint shrink-0" />
                      }
                      <div>
                        <p className="text-sm font-semibold text-ink leading-none">
                          {op.nome}
                          {op.transportadora && (
                            <span className="text-faint font-normal text-[10px] ml-1.5">
                              {op.transportadora}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-faint mt-0.5">
                          {op.id === 'retirada'
                            ? 'Retire hoje mesmo — horário comercial'
                            : `Prazo: até ${op.prazo} ${op.prazo === 1 ? 'dia útil' : 'dias úteis'}`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ml-3 ${gratis ? 'text-green-600' : 'text-ink'}`}>
                      {op.preco === 0 ? 'Grátis 🎉' : formatPrice(op.preco)}
                    </span>
                  </div>
                )
              })}
              <p className="text-[10px] text-faint text-center pt-1">
                Valores calculados por Melhor Envio • Confirme no checkout
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
