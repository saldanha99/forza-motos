'use client'

/**
 * Campos do funil de medida: largura → altura (perfil) → aro.
 * Cada campo só oferece o que existe em estoque, afunilando conforme a
 * escolha anterior. Sem moldura própria — quem usa envolve como quiser
 * (BuscaPorMedida em /pneus, BuscaCombinada na home).
 */
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Check } from 'lucide-react'
import type { IndiceMedidasJSON } from '@/lib/medida-pneu'

export interface SelecaoMedida {
  largura: number | null
  perfil: number | null
  aro: number | null
}

export function FunilMedida({
  indice,
  onSelecao,
}: {
  indice: IndiceMedidasJSON
  /** Reporta a seleção ao pai (o pneu ilustrado acompanha) */
  onSelecao?: (s: SelecaoMedida) => void
}) {
  const router = useRouter()
  const [largura, setLargura] = useState<number | null>(null)
  const [perfil, setPerfil] = useState<number | null>(null)
  const [aro, setAro] = useState<number | null>(null)
  const [buscando, setBuscando] = useState(false)

  const larguras = useMemo(() => indice.map(([l]) => l), [indice])

  const perfis = useMemo(() => {
    if (largura == null) return []
    return (indice.find(([l]) => l === largura)?.[1] ?? []).map(([p]) => p)
  }, [indice, largura])

  const aros = useMemo(() => {
    if (largura == null || perfil == null) return []
    const porPerfil = indice.find(([l]) => l === largura)?.[1] ?? []
    return porPerfil.find(([p]) => p === perfil)?.[1] ?? []
  }, [indice, largura, perfil])

  const qtd = aro != null ? aros.find((a) => a.aro === aro)?.qtd ?? 0 : 0
  const completo = largura != null && perfil != null && aro != null
  const passo = largura == null ? 1 : perfil == null ? 2 : aro == null ? 3 : 4

  function aplicar(s: SelecaoMedida) {
    setLargura(s.largura)
    setPerfil(s.perfil)
    setAro(s.aro)
    onSelecao?.(s)
  }

  function buscar() {
    if (!completo) return
    setBuscando(true)
    router.push(`/produtos?largura=${largura}&perfil=${perfil}&aro=${aro}`)
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        {/* No mobile os três campos ficam lado a lado — são números curtos */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-end sm:gap-3">
          <Campo
            label="Largura"
            passo={1}
            passoAtual={passo}
            valor={largura}
            opcoes={larguras}
            onChange={(v) => aplicar({ largura: v, perfil: null, aro: null })}
            ativo
          />
          <Separador />
          <Campo
            label="Altura"
            passo={2}
            passoAtual={passo}
            valor={perfil}
            opcoes={perfis}
            onChange={(v) => aplicar({ largura, perfil: v, aro: null })}
            ativo={largura != null}
          />
          <Separador aro />
          <Campo
            label="Aro"
            passo={3}
            passoAtual={passo}
            valor={aro}
            opcoes={aros.map((a) => a.aro)}
            onChange={(v) => aplicar({ largura, perfil, aro: v })}
            ativo={perfil != null}
          />
        </div>

        <button
          type="button"
          onClick={buscar}
          disabled={!completo || buscando}
          className="fm-medida__btn w-full sm:w-auto h-[52px] px-7 rounded-xl font-barlow font-bold uppercase tracking-[1.5px] text-[15px] text-white flex items-center justify-center gap-2 whitespace-nowrap sm:ml-1"
        >
          <Search size={17} strokeWidth={2.6} />
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {/* Confirma o que a busca vai entregar */}
      <div className="mt-5 pt-4 border-t border-[#e8e8ec] dark:border-white/10 min-h-[24px]">
        {completo ? (
          <p className="flex items-center gap-2 text-[13.5px] font-inter text-[#444] dark:text-white/85">
            <span className="grid place-items-center w-[18px] h-[18px] rounded-full bg-[#1f9d55] shrink-0">
              <Check size={11} strokeWidth={3.5} className="text-white" />
            </span>
            {qtd > 0 ? (
              <>
                <strong className="text-[#111] dark:text-white font-semibold">
                  {qtd} {qtd === 1 ? 'pneu disponível' : 'pneus disponíveis'}
                </strong>
                na medida {largura}/{perfil}-{aro} · instalação e balanceamento inclusos
              </>
            ) : (
              <>Sem estoque em {largura}/{perfil}-{aro} agora — fale com a gente no WhatsApp</>
            )}
          </p>
        ) : (
          <p className="text-[13px] font-inter text-[#888] dark:text-white/60">
            {passo === 1 && 'Comece pela largura — é o primeiro número da medida'}
            {passo === 2 && 'Agora a altura — o número do meio'}
            {passo === 3 && 'Falta o aro — a polegada, último número'}
          </p>
        )}
      </div>
    </>
  )
}

/** Separador "/" e "–" entre os campos, como a medida é escrita */
function Separador({ aro = false }: { aro?: boolean }) {
  return (
    <span
      aria-hidden
      className="hidden sm:block self-end pb-3.5 text-[#c0c0c8] dark:text-white/25 font-barlow font-bold text-xl leading-none select-none"
    >
      {aro ? '–' : '/'}
    </span>
  )
}

function Campo({
  label,
  passo,
  passoAtual,
  valor,
  opcoes,
  onChange,
  ativo,
}: {
  label: string
  passo: number
  passoAtual: number
  valor: number | null
  opcoes: number[]
  onChange: (v: number | null) => void
  ativo: boolean
}) {
  const emFoco = passoAtual === passo
  return (
    <label className="block min-w-0">
      <span className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`font-barlow font-bold text-[10px] uppercase tracking-[1.8px] transition-colors ${
            ativo ? 'text-[#666] dark:text-white/70' : 'text-[#b4b4bc] dark:text-white/30'
          }`}
        >
          {label}
        </span>
        {emFoco && ativo && <span className="fm-campo__pulso" aria-hidden />}
      </span>

      <div className="relative">
        <select
          value={valor ?? ''}
          disabled={!ativo}
          aria-label={`${label} do pneu`}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="fm-campo__select w-full sm:w-[112px] h-[52px] appearance-none rounded-xl pl-4 pr-9 font-barlow font-bold text-[19px] text-[#111] dark:text-white cursor-pointer disabled:cursor-not-allowed"
        >
          <option value="">—</option>
          {opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 12 8"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3 pointer-events-none"
          fill="none"
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            className={ativo ? 'stroke-[#777] dark:stroke-white/55' : 'stroke-[#c4c4cc] dark:stroke-white/20'}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </label>
  )
}
