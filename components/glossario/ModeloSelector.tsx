'use client'

import { useEffect, useState } from 'react'
import { Check, Zap, Sparkles, Crown, Clock } from 'lucide-react'
import type { AIModel, AIProvider } from '@/lib/glossario/ai-models'

/**
 * Seletor visual de modelo de IA para o admin do glossário.
 *
 * Réplica modernizada do dropdown "Modelo" do plugin Glossário Ninja,
 * agora com:
 *   - Cards visuais por modelo (não dropdown cego)
 *   - Indicação de preço (econômico / médio / premium)
 *   - Velocidade e qualidade visuais
 *   - Filtro por provider
 *   - Recomendado destacado
 *
 * Uso:
 *
 *   const [modeloId, setModeloId] = useState('gemini-2.0-flash')
 *
 *   <ModeloSelector
 *     value={modeloId}
 *     onChange={setModeloId}
 *     quantidadeTermos={500}   // ativa preview de custo
 *   />
 */

interface Props {
  value: string
  onChange: (modeloId: string) => void
  /** Se passado, mostra estimativa de custo para gerar N termos com cada modelo */
  quantidadeTermos?: number
  /** Cotação USD para mostrar preço em BRL. Default 5.50 */
  cotacaoUSD?: number
  /** Filtra para mostrar só um provider */
  fixarProvider?: AIProvider
  /** Inclui modelos legados (default: false) */
  incluirLegacy?: boolean
}

const tierLabel: Record<string, { label: string; cor: string; emoji: string }> = {
  economico: { label: 'Econômico', cor: 'text-green-600 bg-green-50 border-green-200', emoji: '💰' },
  medio: { label: 'Médio', cor: 'text-amber-600 bg-amber-50 border-amber-200', emoji: '⚖️' },
  premium: { label: 'Premium', cor: 'text-rose-600 bg-rose-50 border-rose-200', emoji: '💎' },
}

const qualityIcon: Record<string, React.ReactNode> = {
  basica: <Zap className="w-3.5 h-3.5" />,
  boa: <Sparkles className="w-3.5 h-3.5" />,
  excelente: <Crown className="w-3.5 h-3.5" />,
}

export function ModeloSelector({
  value,
  onChange,
  quantidadeTermos,
  cotacaoUSD = 5.5,
  fixarProvider,
  incluirLegacy = false,
}: Props) {
  const [modelos, setModelos] = useState<AIModel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroProvider, setFiltroProvider] = useState<AIProvider | 'todos'>(
    fixarProvider || 'todos'
  )

  useEffect(() => {
    const params = new URLSearchParams()
    if (fixarProvider) params.set('provider', fixarProvider)
    if (incluirLegacy) params.set('legacy', '1')

    fetch(`/api/glossario/models?${params}`)
      .then((r) => r.json())
      .then((d) => setModelos(d.modelos || []))
      .finally(() => setCarregando(false))
  }, [fixarProvider, incluirLegacy])

  const filtrados =
    filtroProvider === 'todos'
      ? modelos
      : modelos.filter((m) => m.provider === filtroProvider)

  if (carregando) {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-md">
        Carregando modelos...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!fixarProvider && (
        <div className="flex gap-2">
          <FiltroBtn
            ativo={filtroProvider === 'todos'}
            onClick={() => setFiltroProvider('todos')}
          >
            Todos ({modelos.length})
          </FiltroBtn>
          <FiltroBtn
            ativo={filtroProvider === 'gemini'}
            onClick={() => setFiltroProvider('gemini')}
          >
            Gemini ({modelos.filter((m) => m.provider === 'gemini').length})
          </FiltroBtn>
          <FiltroBtn
            ativo={filtroProvider === 'openai'}
            onClick={() => setFiltroProvider('openai')}
          >
            OpenAI ({modelos.filter((m) => m.provider === 'openai').length})
          </FiltroBtn>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtrados.map((m) => {
          const selecionado = value === m.id
          const tier = tierLabel[m.costTier]

          // Estimativa de custo se quantidade foi passada
          let custoBRL: number | null = null
          if (quantidadeTermos && quantidadeTermos > 0) {
            const inputTokens = 350 * quantidadeTermos
            const outputTokens = 1800 * quantidadeTermos
            const usd =
              (inputTokens / 1_000_000) * m.pricing.inputPer1M +
              (outputTokens / 1_000_000) * m.pricing.outputPer1M
            custoBRL = usd * cotacaoUSD
          }

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={`relative text-left p-4 rounded-lg border-2 transition-all ${
                selecionado
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {/* Check de selecionado */}
              {selecionado && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
              )}

              {/* Recomendado */}
              {m.recommended && !selecionado && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  ⭐ Recomendado
                </span>
              )}

              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{m.label}</span>
                {m.legacy && (
                  <span className="text-[10px] uppercase text-muted-foreground border px-1 rounded">
                    legado
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-3">{m.description}</p>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${tier.cor}`}
                >
                  <span>{tier.emoji}</span>
                  {tier.label}
                </span>

                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-muted">
                  {qualityIcon[m.quality]}
                  {m.quality}
                </span>

                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-muted">
                  <Clock className="w-3 h-3" />
                  {m.speed}
                </span>

                <span className="inline-flex items-center px-1.5 py-0.5 rounded border bg-muted font-mono">
                  ${m.pricing.inputPer1M}/${m.pricing.outputPer1M}
                </span>
              </div>

              {/* Estimativa de custo */}
              {custoBRL !== null && (
                <div className="mt-3 pt-3 border-t text-xs">
                  <span className="text-muted-foreground">
                    Estimado para {quantidadeTermos} termos:
                  </span>{' '}
                  <span className="font-semibold text-foreground">
                    R$ {custoBRL.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Ideal para... */}
              <p className="mt-2 text-[11px] text-muted-foreground italic">
                Ideal: {m.ideal}
              </p>
            </button>
          )
        })}
      </div>

      {filtrados.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">
          Nenhum modelo disponível com os filtros atuais.
        </div>
      )}
    </div>
  )
}

function FiltroBtn({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
        ativo
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}
