'use client'

import { useEffect, useState } from 'react'
import { Check, Zap, Sparkles, Crown, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AIModel, AIProvider, CostTier } from '@/lib/glossario/ai-models'
import type { TomStatus } from '@/lib/admin/status'
import { GrupoOpcoes } from '@/components/admin/ui/form'
import { Badge } from '@/components/admin/ui/primitives'

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

const TIER_TOM: Record<CostTier, TomStatus> = {
  economico: 'success',
  medio: 'warning',
  premium: 'danger',
}

const TIER_LABEL: Record<CostTier, { label: string; emoji: string }> = {
  economico: { label: 'Econômico', emoji: '💰' },
  medio: { label: 'Médio', emoji: '⚖️' },
  premium: { label: 'Premium', emoji: '💎' },
}

const qualityIcon: Record<string, React.ReactNode> = {
  basica: <Zap className="h-3.5 w-3.5" />,
  boa: <Sparkles className="h-3.5 w-3.5" />,
  excelente: <Crown className="h-3.5 w-3.5" />,
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
      <div className="rounded-xl border border-brand-border bg-brand-surface-2 p-4 text-sm text-brand-muted">
        Carregando modelos...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!fixarProvider && (
        <GrupoOpcoes
          valor={filtroProvider}
          onChange={setFiltroProvider}
          opcoes={[
            { valor: 'todos', label: `Todos (${modelos.length})` },
            { valor: 'gemini', label: `Gemini (${modelos.filter((m) => m.provider === 'gemini').length})` },
            { valor: 'openai', label: `OpenAI (${modelos.filter((m) => m.provider === 'openai').length})` },
          ]}
          className="max-w-sm"
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtrados.map((m) => {
          const selecionado = value === m.id
          const tier = TIER_LABEL[m.costTier]

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
              className={cn(
                'relative rounded-xl border p-4 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
                selecionado
                  ? 'border-brand-accent bg-brand-accent-soft shadow-cta'
                  : 'border-brand-border bg-brand-surface-2 hover:border-brand-border-strong',
              )}
            >
              {/* Check de selecionado */}
              {selecionado && (
                <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent text-brand-on-accent">
                  <Check className="h-3 w-3" />
                </div>
              )}

              {/* Recomendado */}
              {m.recommended && !selecionado && (
                <span className="absolute right-3 top-3 text-[10px] font-semibold uppercase tracking-wide text-brand-accent">
                  ⭐ Recomendado
                </span>
              )}

              {/* Header */}
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold text-brand-text">{m.label}</span>
                {m.legacy && <Badge tom="neutro">legado</Badge>}
              </div>

              <p className="mb-3 text-xs text-brand-muted">{m.description}</p>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge tom={TIER_TOM[m.costTier]}>
                  <span>{tier.emoji}</span>
                  {tier.label}
                </Badge>

                <Badge tom="neutro">
                  {qualityIcon[m.quality]}
                  {m.quality}
                </Badge>

                <Badge tom="neutro">
                  <Clock className="h-3 w-3" />
                  {m.speed}
                </Badge>

                <Badge tom="neutro" className="font-mono">
                  ${m.pricing.inputPer1M}/${m.pricing.outputPer1M}
                </Badge>
              </div>

              {/* Estimativa de custo */}
              {custoBRL !== null && (
                <div className="mt-3 border-t border-brand-hair pt-3 text-xs">
                  <span className="text-brand-muted">
                    Estimado para {quantidadeTermos} termos:
                  </span>{' '}
                  <span className="font-semibold text-brand-text">
                    R$ {custoBRL.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Ideal para... */}
              <p className="mt-2 text-[11px] italic text-brand-dim">
                Ideal: {m.ideal}
              </p>
            </button>
          )
        })}
      </div>

      {filtrados.length === 0 && (
        <div className="py-8 text-center text-sm text-brand-muted">
          Nenhum modelo disponível com os filtros atuais.
        </div>
      )}
    </div>
  )
}
