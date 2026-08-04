'use client'

/**
 * Funil de busca por medida: largura → altura (perfil) → aro.
 * Cada campo só oferece o que existe de fato no estoque, afunilando conforme
 * a escolha anterior — pedido do Caio na reunião de 20/07 ("digita 130, aí
 * aparece altura 60, 70, 80 e 90"), no lugar da parede de botões anterior.
 *
 * Duas variantes:
 *  · 'barra'  — faixa horizontal compacta, usada sobreposta ao banner (home e /pneus)
 *  · 'painel' — bloco centralizado, para seções dedicadas
 */
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown } from 'lucide-react'
import type { IndiceMedidasJSON } from '@/lib/medida-pneu'

export function BuscaPorMedida({
  indice,
  variante = 'barra',
}: {
  indice: IndiceMedidasJSON
  variante?: 'barra' | 'painel'
}) {
  const router = useRouter()
  const [largura, setLargura] = useState<number | null>(null)
  const [perfil, setPerfil] = useState<number | null>(null)
  const [aro, setAro] = useState<number | null>(null)

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

  function escolherLargura(v: number | null) {
    setLargura(v)
    setPerfil(null)
    setAro(null)
  }

  function escolherPerfil(v: number | null) {
    setPerfil(v)
    setAro(null)
  }

  function buscar() {
    if (!completo) return
    router.push(`/produtos?largura=${largura}&perfil=${perfil}&aro=${aro}`)
  }

  const campos = (
    <>
      <Campo label="Largura" valor={largura} opcoes={larguras} onChange={escolherLargura} ativo />
      <Campo label="Altura" valor={perfil} opcoes={perfis} onChange={escolherPerfil} ativo={largura != null} />
      <Campo
        label="Aro"
        valor={aro}
        opcoes={aros.map((a) => a.aro)}
        onChange={setAro}
        ativo={perfil != null}
      />
    </>
  )

  if (variante === 'barra') {
    return (
      <div className="bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.14)] border border-[#ececef] px-5 py-4 md:px-7 md:py-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
          <div className="lg:flex-1">
            <p className="text-[11px] font-semibold tracking-[2px] text-[#d42b2b] uppercase mb-0.5">
              Busque por medida
            </p>
            <p className="font-barlow font-bold text-lg md:text-xl text-[#111] leading-tight">
              Encontre o pneu na medida certa da sua moto
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-end">
            {campos}
            <button
              type="button"
              onClick={buscar}
              disabled={!completo}
              className="h-[46px] px-6 bg-[#111] hover:bg-[#d42b2b] disabled:bg-[#ccc] disabled:cursor-not-allowed text-white font-barlow font-bold uppercase tracking-wider text-sm rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Search size={15} />
              Buscar
            </button>
          </div>
        </div>

        {completo && (
          <p className="text-[13px] text-[#666] font-inter mt-3 pt-3 border-t border-[#f0f0f2]">
            {qtd > 0
              ? `${qtd} ${qtd === 1 ? 'pneu disponível' : 'pneus disponíveis'} na medida ${largura}/${perfil}-${aro}`
              : `Nenhum pneu ${largura}/${perfil}-${aro} em estoque agora`}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{campos}</div>
      <button
        type="button"
        onClick={buscar}
        disabled={!completo}
        className="w-full mt-4 bg-[#d42b2b] hover:bg-red-700 disabled:bg-[#ccc] disabled:cursor-not-allowed text-white font-barlow font-bold uppercase tracking-wider py-3.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
      >
        <Search size={16} />
        {completo
          ? `Ver ${qtd} ${qtd === 1 ? 'pneu' : 'pneus'} ${largura}/${perfil}-${aro}`
          : 'Escolha a medida completa'}
      </button>
      <p className="text-center text-[13px] text-[#888] font-inter mt-3">
        A medida está gravada na lateral do pneu, no formato{' '}
        <strong className="text-[#555]">largura / altura – aro</strong> (ex.: 150/60-17)
      </p>
    </div>
  )
}

function Campo({
  label,
  valor,
  opcoes,
  onChange,
  ativo,
}: {
  label: string
  valor: number | null
  opcoes: number[]
  onChange: (v: number | null) => void
  ativo: boolean
}) {
  return (
    <label className={`block ${ativo ? '' : 'opacity-50'}`}>
      <span className="block font-barlow font-bold text-[10px] uppercase tracking-[1.5px] text-[#888] mb-1">
        {label}
      </span>
      <div className="relative">
        <select
          value={valor ?? ''}
          disabled={!ativo}
          aria-label={label}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full sm:w-[104px] h-[46px] appearance-none rounded-lg border-2 border-[#ddd] focus:border-[#d42b2b] outline-none bg-white pl-3.5 pr-8 font-barlow font-bold text-base text-[#111] disabled:bg-[#f4f4f5] disabled:cursor-not-allowed cursor-pointer"
        >
          <option value="">—</option>
          {opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none"
        />
      </div>
    </label>
  )
}
