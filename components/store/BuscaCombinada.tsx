'use client'

/**
 * Home: os dois caminhos de busca de pneu numa área só.
 *
 * Em vez de dois blocos disputando espaço, um único painel com duas abas —
 * "Pela medida" e "Pela placa". O cliente vê que existem os dois caminhos sem
 * poluição visual.
 *
 * Sem ilustração: o pneu desenhado que ficava à esquerda tinha roda de carro e
 * saiu a pedido da loja. O painel agora usa a largura inteira.
 *
 * A aba inicial é a MEDIDA porque ela funciona para todo o estoque hoje. A
 * placa só devolve medida das motos já conferidas em /admin/motos — quando
 * essa cobertura crescer, basta trocar o estado inicial de `aba`.
 */
import { useState } from 'react'
import { Ruler, ScanLine } from 'lucide-react'
import type { IndiceMedidasJSON } from '@/lib/medida-pneu'
import { FunilMedida } from './FunilMedida'
import { BuscaPorPlaca } from './BuscaPorPlaca'

type Aba = 'medida' | 'placa'

export function BuscaCombinada({ indice }: { indice: IndiceMedidasJSON }) {
  const [aba, setAba] = useState<Aba>('medida')

  return (
    <div className="fm-medida relative overflow-hidden rounded-2xl">
      <div aria-hidden className="fm-medida__fundo" />
      <div aria-hidden className="fm-medida__grao" />
      <div aria-hidden className="fm-medida__brilho" />

      <div className="relative px-6 py-7 md:px-9 md:py-8">
        <div className="w-full min-w-0">
          {/* Abas — deixam explícito que há dois caminhos */}
          <div
            role="tablist"
            aria-label="Como encontrar seu pneu"
            className="inline-flex p-1 rounded-xl bg-[#f0f0f3] dark:bg-white/5 mb-4"
          >
            <Tab ativa={aba === 'medida'} onClick={() => setAba('medida')} icone={<Ruler size={14} />}>
              Pela medida
            </Tab>
            <Tab ativa={aba === 'placa'} onClick={() => setAba('placa')} icone={<ScanLine size={14} />}>
              Pela placa
            </Tab>
          </div>

          {aba === 'medida' ? (
            <div role="tabpanel" aria-label="Busca pela medida">
              <h3 className="font-barlow font-bold text-xl md:text-[27px] text-[#111] dark:text-white leading-[1.15] tracking-[-0.4px] mb-1">
                Encontre o pneu certo <span className="text-[#d42b2b]">da sua moto</span>
              </h3>
              <p className="text-[13px] text-[#666] dark:text-white/65 font-inter leading-relaxed mb-4">
                A medida está gravada na lateral do seu pneu atual, no formato 120/70-17.
              </p>
              <FunilMedida indice={indice} />
            </div>
          ) : (
            <div role="tabpanel" aria-label="Busca pela placa">
              <h3 className="font-barlow font-bold text-xl md:text-[27px] text-[#111] dark:text-white leading-[1.15] tracking-[-0.4px] mb-1">
                Não sabe a medida? <span className="text-[#d42b2b]">Digite a placa</span>
              </h3>
              <p className="text-[13px] text-[#666] dark:text-white/65 font-inter leading-relaxed mb-4">
                A gente identifica sua moto e mostra o que serve nela — sem precisar saber medida nem modelo.
              </p>
              <BuscaPorPlaca />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Tab({
  ativa,
  onClick,
  icone,
  children,
}: {
  ativa: boolean
  onClick: () => void
  icone: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 h-[44px] sm:h-[38px] rounded-lg font-barlow font-bold text-[12.5px] uppercase tracking-[1.2px] transition-colors ${
        ativa
          ? 'bg-white dark:bg-[#22222a] text-[#111] dark:text-white shadow-sm'
          : 'text-[#8a8a94] hover:text-[#555] dark:hover:text-white/80'
      }`}
    >
      {icone}
      {children}
    </button>
  )
}
