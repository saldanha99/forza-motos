'use client'

/**
 * Busca por medida — usada na seção dedicada de /pneus. Na home, quem manda é
 * a BuscaCombinada (placa + medida em abas).
 *
 * Sem ilustração de pneu: o desenho que ficava ao lado era uma roda de carro e
 * saiu a pedido da loja. O texto sozinho já diz onde ler a medida.
 */
import type { IndiceMedidasJSON } from '@/lib/medida-pneu'
import { FunilMedida } from './FunilMedida'

export function BuscaPorMedida({ indice }: { indice: IndiceMedidasJSON }) {
  return (
    <div className="fm-medida relative overflow-hidden rounded-2xl">
      <div aria-hidden className="fm-medida__fundo" />
      <div aria-hidden className="fm-medida__grao" />
      <div aria-hidden className="fm-medida__brilho" />

      <div className="relative px-6 py-7 md:px-9 md:py-8">
        <div className="w-full min-w-0">
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
            A medida está gravada na lateral do seu pneu atual, no formato 120/70-17.
          </p>

          <FunilMedida indice={indice} />
        </div>
      </div>
    </div>
  )
}
