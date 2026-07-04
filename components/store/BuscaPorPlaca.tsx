'use client'

/**
 * Busca de produtos pela PLACA da moto (estilo Pneu Store).
 * Digita a placa → identifica a moto → leva pros produtos compatíveis.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Search, LoaderCircle, Bike, TriangleAlert } from 'lucide-react'

type Resultado = {
  veiculo: { marca: string; modelo: string; ano: string; cor: string }
  modeloSlug: string | null
  termoBusca: string | null
}

export function BuscaPorPlaca() {
  const [placa, setPlaca] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setRes(null)
    if (placa.replace(/[^A-Za-z0-9]/g, '').length !== 7) {
      setErro('Digite a placa completa (7 caracteres).')
      return
    }
    setCarregando(true)
    try {
      const r = await fetch('/api/placa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placa }),
      })
      const data = await r.json()
      if (!r.ok) {
        setErro(data.error ?? 'Erro ao consultar a placa.')
        return
      }
      setRes(data)
    } catch {
      setErro('Falha de conexão — tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const linkProdutos = res
    ? res.modeloSlug
      ? `/pneus/${res.modeloSlug}`
      : `/produtos?busca=${encodeURIComponent(res.termoBusca ?? res.veiculo.modelo)}`
    : '#'

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={buscar} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-[#999] bg-[#f0f0f2] border border-[#ddd] rounded px-1.5 py-0.5">
            BR
          </span>
          <input
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="ABC1D23"
            aria-label="Placa da moto"
            className="w-full rounded-lg border-2 border-[#ddd] focus:border-[#d42b2b] outline-none pl-12 pr-3 py-3 font-barlow font-bold text-xl tracking-[3px] text-[#111] uppercase placeholder:text-[#bbb]"
          />
        </div>
        <button
          type="submit"
          disabled={carregando}
          className="bg-[#d42b2b] hover:bg-red-700 disabled:opacity-60 text-white font-barlow font-bold uppercase px-6 rounded-lg text-sm tracking-wider transition-colors flex items-center gap-2"
        >
          {carregando ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
      </form>

      {erro && (
        <p className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          <TriangleAlert size={14} /> {erro}
        </p>
      )}

      {res && (
        <div className="flex flex-wrap items-center gap-3 bg-white border-2 border-emerald-500/40 rounded-xl px-4 py-3 mt-3">
          <Bike size={22} className="text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-[180px]">
            <p className="font-barlow font-bold text-[#111] leading-tight">
              {res.veiculo.marca} {res.veiculo.modelo}
            </p>
            <p className="text-xs text-[#777]">
              {res.veiculo.ano}{res.veiculo.cor ? ` · ${res.veiculo.cor.toLowerCase()}` : ''}
            </p>
          </div>
          <Link
            href={linkProdutos}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-barlow font-bold uppercase px-5 py-2.5 rounded-lg text-xs tracking-wider transition-colors"
          >
            Ver produtos compatíveis →
          </Link>
        </div>
      )}
    </div>
  )
}
