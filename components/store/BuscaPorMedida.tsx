'use client'

/**
 * Busca por medida com o pneu ilustrado ao lado — usada na seção dedicada
 * de /pneus. Na home, quem manda é a BuscaCombinada (placa + medida em abas).
 *
 * O pneu grava a medida na parede lateral em tempo real: é onde o cliente lê
 * a medida no pneu de verdade, então a peça ensina enquanto ele busca.
 */
import { useState } from 'react'
import type { IndiceMedidasJSON } from '@/lib/medida-pneu'
import { PneuRealista } from './PneuRealista'
import { FunilMedida, type SelecaoMedida } from './FunilMedida'

const VAZIO: SelecaoMedida = { largura: null, perfil: null, aro: null }

export function BuscaPorMedida({ indice }: { indice: IndiceMedidasJSON }) {
  const [sel, setSel] = useState<SelecaoMedida>(VAZIO)
  const completo = sel.largura != null && sel.perfil != null && sel.aro != null

  return (
    <div className="fm-medida relative overflow-hidden rounded-2xl">
      <div aria-hidden className="fm-medida__fundo" />
      <div aria-hidden className="fm-medida__grao" />
      <div aria-hidden className="fm-medida__brilho" />

      <div className="relative flex flex-col lg:flex-row items-center gap-6 lg:gap-9 px-6 py-7 md:px-9 md:py-8">
        <div className="shrink-0 w-[148px] md:w-[176px] lg:w-[196px]">
          <PneuRealista
            largura={sel.largura}
            perfil={sel.perfil}
            aro={sel.aro}
            className={`w-full h-auto drop-shadow-2xl fm-medida__pneu ${completo ? 'is-completo' : ''}`}
          />
        </div>

        <div className="flex-1 w-full min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="h-px w-7 bg-[#d42b2b]" />
            <span className="text-[11px] font-semibold tracking-[2.5px] text-[#d42b2b] uppercase font-inter">
              Busque pela medida
            </span>
          </div>

          <h3 className="font-barlow font-bold text-2xl md:text-[32px] text-[#111] dark:text-white leading-[1.12] tracking-[-0.5px] mb-1.5">
            Encontre o pneu certo <span className="text-[#d42b2b]">da sua moto</span>
          </h3>
          <p className="text-[13.5px] text-[#666] dark:text-white/65 font-inter leading-relaxed mb-5">
            A medida está gravada na lateral do seu pneu atual — igual à do desenho ao lado.
          </p>

          <FunilMedida indice={indice} onSelecao={setSel} />
        </div>
      </div>
    </div>
  )
}
