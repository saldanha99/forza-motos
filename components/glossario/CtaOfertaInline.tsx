import Link from 'next/link'
import { Gift, ShieldCheck, ArrowRight } from 'lucide-react'

/**
 * Banner de oferta inline para o glossário — destaca frete grátis +
 * credenciamento de marcas (Pirelli, Metzeler, Michelin) e leva à loja.
 */
export function CtaOfertaInline() {
  return (
    <Link href="/produtos" className="block group my-10">
      <div
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg,#d42b2b,#8a1818)' }}
      >
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-15" style={{ background: '#fff' }} />
        <div className="absolute -right-2 bottom-0 w-20 h-20 rounded-full opacity-10" style={{ background: '#fff' }} />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-90">
              <Gift size={13} /> Oferta Forza Motos
            </span>
            <p className="font-barlow font-black text-2xl leading-tight mt-1.5">
              Frete grátis acima de R$299
            </p>
            <p className="text-sm opacity-90 mt-1 flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Credenciada Pirelli, Metzeler e Michelin · entrega para todo o Brasil
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-sm whitespace-nowrap transition-all group-hover:gap-3"
            style={{ background: '#fff', color: '#d42b2b' }}>
            Ver produtos
            <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  )
}
