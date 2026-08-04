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
  motoSlug: string | null
  medidas: { dianteira: string; traseira: string } | null
}

/** "120/70-19" → /produtos?largura=120&perfil=70&aro=19 */
function linkMedida(medida: string): string | null {
  const m = medida.match(/(\d{2,3})\/(\d{2,3})[-\sRZB]*(\d{2})/i)
  if (!m) return null
  return `/produtos?largura=${m[1]}&perfil=${m[2]}&aro=${m[3]}`
}

export function BuscaPorPlaca({
  onResultado,
}: {
  /** Avisa o pai da medida encontrada (o pneu ilustrado da home acompanha) */
  onResultado?: (medidas: { dianteira: string; traseira: string } | null) => void
} = {}) {
  const [placa, setPlaca] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)

  async function buscar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setRes(null)
    onResultado?.(null)
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
      onResultado?.(data.medidas ?? null)
    } catch {
      setErro('Falha de conexão — tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  // Prioridade: /moto/[slug] (tudo que serve na moto) > /pneus/[modelo] > busca genérica.
  // Sem nenhum dos três, NÃO inventamos uma busca: mandar o cliente para uma
  // listagem aleatória é pior que assumir que ainda não temos a moto mapeada.
  const linkProdutos = res
    ? res.motoSlug
      ? `/moto/${res.motoSlug}`
      : res.modeloSlug
        ? `/pneus/${res.modeloSlug}`
        : res.termoBusca
          ? `/produtos?busca=${encodeURIComponent(res.termoBusca)}`
          : null
    : null

  const linkWhatsapp = res
    ? `https://wa.me/5519974049445?text=${encodeURIComponent(
        `Olá! Tenho uma ${res.veiculo.marca} ${res.veiculo.modelo}${res.veiculo.ano ? ` ${res.veiculo.ano}` : ''}. Quais pneus vocês têm para ela?`,
      )}`
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
        <div className="bg-white border-2 border-emerald-500/40 rounded-xl px-4 py-3 mt-3">
          <div className="flex flex-wrap items-center gap-3">
            <Bike size={22} className="text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-[180px]">
              <p className="font-barlow font-bold text-[#111] leading-tight">
                {res.veiculo.marca} {res.veiculo.modelo}
              </p>
              <p className="text-xs text-[#777]">
                {res.veiculo.ano}{res.veiculo.cor ? ` · ${res.veiculo.cor.toLowerCase()}` : ''}
              </p>
            </div>
            {linkProdutos ? (
              <Link
                href={linkProdutos}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-barlow font-bold uppercase px-5 py-2.5 rounded-lg text-xs tracking-wider transition-colors"
              >
                Ver produtos compatíveis →
              </Link>
            ) : (
              <a
                href={linkWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#25D366] hover:bg-[#1eb85a] text-white font-barlow font-bold uppercase px-5 py-2.5 rounded-lg text-xs tracking-wider transition-colors"
              >
                Consultar no WhatsApp →
              </a>
            )}
          </div>

          {/* Medida de fábrica da moto — o atalho que o cliente realmente quer */}
          {res.medidas && (
            <div className="border-t border-[#eee] mt-3 pt-3">
              <p className="text-[11px] font-semibold tracking-[1.5px] text-[#999] uppercase mb-2">
                Medidas de fábrica da sua moto
              </p>
              {/* A moto aceita radial e diagonal na mesma medida — a escolha
                  é do cliente na listagem, então aqui não se afirma um tipo */}
              <p className="text-[12px] text-[#888] font-inter -mt-1 mb-2">
                Nessas medidas você escolhe entre pneu radial ou diagonal
              </p>
              <div className="flex flex-wrap gap-2">
                {([
                  ['Dianteiro', res.medidas.dianteira],
                  ['Traseiro', res.medidas.traseira],
                ] as const).map(([rotulo, medida]) => {
                  const href = linkMedida(medida)
                  const conteudo = (
                    <>
                      <span className="text-[10px] uppercase tracking-wider text-[#999] block leading-none mb-1">
                        {rotulo}
                      </span>
                      <span className="font-barlow font-bold text-[17px] text-[#111] leading-none">{medida}</span>
                    </>
                  )
                  return href ? (
                    <Link
                      key={rotulo}
                      href={href}
                      className="px-4 py-2 rounded-lg border-2 border-[#e2e2e6] hover:border-[#d42b2b] transition-colors"
                    >
                      {conteudo}
                    </Link>
                  ) : (
                    <span key={rotulo} className="px-4 py-2 rounded-lg border-2 border-[#e2e2e6]">
                      {conteudo}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {!linkProdutos && !res.medidas && (
            <p className="text-[13px] text-[#666] font-inter border-t border-[#eee] mt-3 pt-3">
              Identificamos sua moto, mas ainda não temos as medidas dela mapeadas no site.
              Chame no WhatsApp que a gente confirma o pneu certo na hora — ou{' '}
              <a href="#medida" className="text-[#d42b2b] font-semibold hover:underline">
                busque pela medida
              </a>{' '}
              gravada no seu pneu atual.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
