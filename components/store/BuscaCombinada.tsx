'use client'

/**
 * Home: os dois caminhos de busca de pneu numa área só.
 *
 * Em vez de dois blocos disputando espaço, um único painel com duas abas —
 * "Pela medida" e "Pela placa". O cliente vê que existem os dois caminhos sem
 * poluição visual, e o pneu ilustrado serve aos dois: na medida ele acompanha
 * o funil; na placa, grava a medida de fábrica que a consulta devolveu.
 *
 * A aba inicial é a MEDIDA porque ela funciona para todo o estoque hoje. A
 * placa só devolve medida das motos já conferidas em /admin/motos — quando
 * essa cobertura crescer, basta trocar o estado inicial de `aba`.
 */
import { useState } from 'react'
import { Ruler, ScanLine } from 'lucide-react'
import type { IndiceMedidasJSON } from '@/lib/medida-pneu'
import { PneuRealista } from './PneuRealista'
import { FunilMedida, type SelecaoMedida } from './FunilMedida'
import { BuscaPorPlaca } from './BuscaPorPlaca'
import { parseMedida } from '@/lib/medida-pneu'

type Aba = 'medida' | 'placa'
const VAZIO: SelecaoMedida = { largura: null, perfil: null, aro: null }

export function BuscaCombinada({ indice }: { indice: IndiceMedidasJSON }) {
  const [aba, setAba] = useState<Aba>('medida')
  const [selMedida, setSelMedida] = useState<SelecaoMedida>(VAZIO)
  const [selPlaca, setSelPlaca] = useState<SelecaoMedida>(VAZIO)

  // O pneu mostra o que a aba ativa produziu
  const sel = aba === 'medida' ? selMedida : selPlaca
  const completo = sel.largura != null && sel.perfil != null && sel.aro != null

  /** A placa devolve "120/70-19"; o pneu precisa dos três números */
  function medidasDaPlaca(medidas: { dianteira: string; traseira: string } | null) {
    if (!medidas) return setSelPlaca(VAZIO)
    const m = parseMedida(medidas.dianteira)
    setSelPlaca(m ? { largura: m.largura, perfil: m.perfil, aro: m.aro } : VAZIO)
  }

  return (
    <div className="fm-medida relative overflow-hidden rounded-2xl">
      <div aria-hidden className="fm-medida__fundo" />
      <div aria-hidden className="fm-medida__grao" />
      <div aria-hidden className="fm-medida__brilho" />

      <div className="relative flex flex-col lg:flex-row items-center gap-6 lg:gap-9 px-6 py-7 md:px-9 md:py-8">
        <div className="shrink-0 w-[132px] md:w-[164px] lg:w-[188px]">
          <PneuRealista
            largura={sel.largura}
            perfil={sel.perfil}
            aro={sel.aro}
            className={`w-full h-auto drop-shadow-2xl fm-medida__pneu ${completo ? 'is-completo' : ''}`}
          />
        </div>

        <div className="flex-1 w-full min-w-0">
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
                A medida está gravada na lateral do seu pneu atual — igual à do desenho ao lado.
              </p>
              <FunilMedida indice={indice} onSelecao={setSelMedida} />
            </div>
          ) : (
            <div role="tabpanel" aria-label="Busca pela placa">
              <h3 className="font-barlow font-bold text-xl md:text-[27px] text-[#111] dark:text-white leading-[1.15] tracking-[-0.4px] mb-1">
                Não sabe a medida? <span className="text-[#d42b2b]">Digite a placa</span>
              </h3>
              <p className="text-[13px] text-[#666] dark:text-white/65 font-inter leading-relaxed mb-4">
                A gente identifica sua moto e mostra o que serve nela — sem precisar saber medida nem modelo.
              </p>
              <BuscaPorPlaca onResultado={medidasDaPlaca} />
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
