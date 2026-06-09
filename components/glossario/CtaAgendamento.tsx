import Link from 'next/link'
import { Wrench, Clock, ArrowRight } from 'lucide-react'

/**
 * CTA de agendamento do box rápido — injetado no meio do conteúdo do glossário.
 * Direciona o leitor para /agendar (troca de pneu, freio, óleo em ~30 min).
 */
export function CtaAgendamento() {
  return (
    <div
      className="my-10 rounded-2xl overflow-hidden border"
      style={{ borderColor: 'rgba(212,43,43,0.20)' }}
    >
      <div className="grid sm:grid-cols-[1fr_auto] items-center gap-4 p-6"
        style={{ background: 'linear-gradient(135deg, rgba(212,43,43,0.06), rgba(212,43,43,0.02))' }}>
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg,#d42b2b,#8a1818)' }}
          >
            <Wrench size={22} />
          </div>
          <div>
            <p className="font-barlow font-black text-lg text-[#111] leading-tight">
              Precisa instalar ou trocar na sua moto?
            </p>
            <p className="text-sm text-[#555] mt-1 flex items-center gap-1.5">
              <Clock size={14} className="text-[#d42b2b]" />
              Box rápido em Campinas — pneu, freio e óleo em ~30 min, sem agendamento prévio.
            </p>
          </div>
        </div>
        <Link
          href="/agendar"
          className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-bold text-sm text-white whitespace-nowrap transition-all hover:brightness-110"
          style={{ background: '#d42b2b' }}
        >
          Agendar serviço
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
