'use client'

/**
 * Funil de busca por medida: largura → altura (perfil) → aro.
 * Cada campo só oferece o que existe de fato no estoque, afunilando conforme
 * a escolha anterior — pedido do Caio na reunião de 20/07 ("digita 130, aí
 * aparece altura 60, 70, 80 e 90").
 *
 * O pneu ao lado grava a medida na parede lateral em tempo real: é onde o
 * cliente lê a medida no pneu de verdade, então a peça ensina enquanto busca.
 */
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Check } from 'lucide-react'
import type { IndiceMedidasJSON } from '@/lib/medida-pneu'
import { PneuRealista } from './PneuRealista'

export function BuscaPorMedida({ indice }: { indice: IndiceMedidasJSON }) {
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
    setBuscando(true)
    router.push(`/produtos?largura=${largura}&perfil=${perfil}&aro=${aro}`)
  }

  return (
    <div className="fm-medida relative overflow-hidden rounded-2xl">
      {/* Asfalto: gradiente + grão + vinheta */}
      <div aria-hidden className="fm-medida__asfalto" />
      <div aria-hidden className="fm-medida__grao" />
      <div aria-hidden className="fm-medida__brilho" />

      <div className="relative flex flex-col lg:flex-row items-center gap-6 lg:gap-9 px-6 py-7 md:px-9 md:py-8">
        {/* Pneu com a medida gravada */}
        <div className="shrink-0 w-[148px] md:w-[176px] lg:w-[196px]">
          <PneuRealista
            largura={largura}
            perfil={perfil}
            aro={aro}
            className={`w-full h-auto drop-shadow-2xl fm-medida__pneu ${completo ? 'is-completo' : ''}`}
          />
        </div>

        <div className="flex-1 w-full min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="h-px w-7 bg-[#d42b2b]" />
            <span className="text-[11px] font-semibold tracking-[2.5px] text-[#ff5a5a] uppercase font-inter">
              Busque pela medida
            </span>
          </div>

          <h3 className="font-barlow font-bold text-2xl md:text-[32px] text-white leading-[1.12] tracking-[-0.5px] mb-1.5">
            Encontre o pneu certo <span className="text-[#ff4d4d]">da sua moto</span>
          </h3>
          <p className="text-[13.5px] text-white/65 font-inter leading-relaxed mb-5">
            A medida está gravada na lateral do seu pneu atual — igual à do desenho ao lado.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            {/* No mobile os três campos ficam lado a lado — são números curtos */}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-end sm:gap-3">
              <Campo
                label="Largura"
                passo={1}
                passoAtual={passo}
                valor={largura}
                opcoes={larguras}
                onChange={escolherLargura}
                ativo
              />
              <Separador />
              <Campo
                label="Altura"
                passo={2}
                passoAtual={passo}
                valor={perfil}
                opcoes={perfis}
                onChange={escolherPerfil}
                ativo={largura != null}
              />
              <Separador aro />
              <Campo
                label="Aro"
                passo={3}
                passoAtual={passo}
                valor={aro}
                opcoes={aros.map((a) => a.aro)}
                onChange={setAro}
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

          {/* Faixa de status: confirma o que a busca vai entregar */}
          <div className="mt-5 pt-4 border-t border-white/10 min-h-[24px]">
            {completo ? (
              <p className="flex items-center gap-2 text-[13.5px] font-inter text-white/85">
                <span className="grid place-items-center w-[18px] h-[18px] rounded-full bg-[#1f9d55] shrink-0">
                  <Check size={11} strokeWidth={3.5} className="text-white" />
                </span>
                {qtd > 0 ? (
                  <>
                    <strong className="text-white font-semibold">
                      {qtd} {qtd === 1 ? 'pneu disponível' : 'pneus disponíveis'}
                    </strong>
                    na medida {largura}/{perfil}-{aro} · instalação e balanceamento inclusos
                  </>
                ) : (
                  <>Sem estoque em {largura}/{perfil}-{aro} agora — fale com a gente no WhatsApp</>
                )}
              </p>
            ) : (
              <p className="text-[13px] font-inter text-white/60">
                {passo === 1 && 'Comece pela largura — é o primeiro número da medida'}
                {passo === 2 && 'Agora a altura — o número do meio'}
                {passo === 3 && 'Falta o aro — a polegada, último número'}
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .fm-medida {
          background: #0b0b0e;
          border: 1px solid rgba(255, 255, 255, 0.09);
          box-shadow:
            0 28px 60px -18px rgba(0, 0, 0, 0.75),
            0 2px 0 0 rgba(255, 255, 255, 0.05) inset;
        }
        /* Asfalto */
        .fm-medida__asfalto {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(120% 90% at 12% 0%, #24242c 0%, #131318 45%, #0a0a0d 100%),
            linear-gradient(180deg, #16161b 0%, #0b0b0e 100%);
        }
        /* Grão fino do piso */
        .fm-medida__grao {
          position: absolute;
          inset: 0;
          opacity: 0.5;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
        }
        /* Facho de luz vindo da esquerda, como uma lâmpada de oficina */
        .fm-medida__brilho {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(46% 70% at 14% 8%, rgba(255, 255, 255, 0.1) 0%, transparent 62%),
            radial-gradient(38% 60% at 88% 100%, rgba(212, 43, 43, 0.16) 0%, transparent 70%);
        }
        .fm-medida__pneu {
          transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .fm-medida__pneu.is-completo {
          transform: rotate(-8deg) scale(1.03);
        }
        /* Botão com relevo de metal pintado */
        .fm-medida__btn {
          background: linear-gradient(180deg, #e8413f 0%, #d42b2b 52%, #a81f1f 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 -2px 0 rgba(0, 0, 0, 0.28) inset,
            0 10px 22px -6px rgba(212, 43, 43, 0.55);
          transition:
            filter 180ms ease-out,
            transform 120ms ease-out,
            box-shadow 180ms ease-out;
        }
        .fm-medida__btn:hover:not(:disabled) {
          filter: brightness(1.09);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.4) inset,
            0 -2px 0 rgba(0, 0, 0, 0.28) inset,
            0 14px 30px -6px rgba(212, 43, 43, 0.7);
        }
        .fm-medida__btn:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.25) inset,
            0 -1px 0 rgba(0, 0, 0, 0.3) inset,
            0 5px 12px -4px rgba(212, 43, 43, 0.5);
        }
        .fm-medida__btn:disabled {
          background: linear-gradient(180deg, #2e2e36 0%, #22222a 100%);
          color: rgba(255, 255, 255, 0.38);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset;
          cursor: not-allowed;
        }
        .fm-medida__btn:focus-visible {
          outline: 3px solid #ff8f8f;
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .fm-medida__pneu,
          .fm-medida__btn {
            transition: none;
          }
          .fm-medida__pneu.is-completo {
            transform: none;
          }
        }
      `}</style>
    </div>
  )
}

/** Separador "/" e "-" entre os campos, como a medida é escrita */
function Separador({ aro = false }: { aro?: boolean }) {
  return (
    <span
      aria-hidden
      className="hidden sm:block self-end pb-3.5 text-white/25 font-barlow font-bold text-xl leading-none select-none"
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
            ativo ? 'text-white/70' : 'text-white/30'
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
          className="fm-campo__select w-full sm:w-[112px] h-[52px] appearance-none rounded-xl pl-4 pr-9 font-barlow font-bold text-[19px] text-white cursor-pointer disabled:cursor-not-allowed"
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
            stroke={ativo ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)'}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <style jsx>{`
        /* Campo "entalhado" no painel, como instrumento de oficina */
        .fm-campo__select {
          background: linear-gradient(180deg, #16161c 0%, #1d1d24 100%);
          border: 1px solid rgba(255, 255, 255, 0.13);
          box-shadow:
            0 2px 6px rgba(0, 0, 0, 0.5) inset,
            0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            border-color 180ms ease-out,
            box-shadow 180ms ease-out;
        }
        .fm-campo__select:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.26);
        }
        .fm-campo__select:focus {
          outline: none;
          border-color: #d42b2b;
          box-shadow:
            0 2px 6px rgba(0, 0, 0, 0.5) inset,
            0 0 0 3px rgba(212, 43, 43, 0.28);
        }
        .fm-campo__select:disabled {
          background: linear-gradient(180deg, #131317 0%, #16161b 100%);
          color: rgba(255, 255, 255, 0.28);
          border-color: rgba(255, 255, 255, 0.07);
        }
        .fm-campo__select option {
          background: #17171d;
          color: #fff;
        }
        /* Ponto pulsante indicando o campo da vez */
        .fm-campo__pulso {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #ff4d4d;
          box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.6);
          animation: fm-pulso 1.8s ease-out infinite;
        }
        @keyframes fm-pulso {
          70% {
            box-shadow: 0 0 0 7px rgba(255, 77, 77, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 77, 77, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .fm-campo__pulso {
            animation: none;
          }
          .fm-campo__select {
            transition: none;
          }
        }
      `}</style>
    </label>
  )
}
