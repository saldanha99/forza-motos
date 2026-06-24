export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CheckCircle, Calendar, MapPin } from 'lucide-react'

export default async function EventoSucessoPage({
  searchParams,
}: {
  searchParams: { inscricao?: string; pendente?: string }
}) {
  const inscricao = searchParams.inscricao
    ? await prisma.eventoInscricao.findUnique({
        where: { id: searchParams.inscricao },
        include: { evento: true },
      })
    : null

  const pendente = searchParams.pendente === '1'

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${pendente ? 'bg-yellow-50' : 'bg-green-50'}`}>
        <CheckCircle size={40} className={pendente ? 'text-yellow-500' : 'text-green-600'} />
      </div>

      <h1 className="font-barlow font-black text-3xl text-[#111] mb-3">
        {pendente ? 'Pagamento em análise' : 'Inscrição confirmada!'}
      </h1>

      {inscricao && (
        <div className="bg-[#fafafa] border border-[#eee] rounded-2xl p-5 mb-6 text-left">
          <p className="text-xs text-[#999] uppercase tracking-widest font-semibold mb-3">Detalhes da inscrição</p>
          <p className="font-barlow font-bold text-[#111] text-lg mb-1">{inscricao.evento.titulo}</p>
          <div className="flex items-center gap-2 text-sm text-[#666] font-inter mb-1">
            <Calendar size={13} className="text-[#d42b2b]" />
            {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(inscricao.evento.dataInicio)}
          </div>
          <div className="flex items-center gap-2 text-sm text-[#666] font-inter mb-3">
            <MapPin size={13} className="text-[#d42b2b]" />
            {inscricao.evento.local}
          </div>
          <div className="border-t border-[#eee] pt-3 flex justify-between text-sm font-inter">
            <span className="text-[#888]">Participante</span>
            <span className="font-semibold text-[#333]">{inscricao.nome}</span>
          </div>
          <div className="flex justify-between text-sm font-inter mt-1">
            <span className="text-[#888]">Ingressos</span>
            <span className="font-semibold text-[#333]">{inscricao.quantidade}x</span>
          </div>
          {Number(inscricao.total) > 0 && (
            <div className="flex justify-between text-sm font-inter mt-1">
              <span className="text-[#888]">Total pago</span>
              <span className="font-bold text-[#d42b2b]">R$ {Number(inscricao.total).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <p className="text-[#666] text-sm font-inter mb-8 leading-relaxed">
        {pendente
          ? 'Seu pagamento está sendo processado. Você receberá a confirmação em breve.'
          : 'Sua vaga está garantida! Em breve entraremos em contato com mais detalhes pelo WhatsApp ou e-mail.'}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/calendario"
          className="bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-xl transition-colors"
        >
          Ver mais eventos
        </Link>
        <a
          href="https://wa.me/5519974049445"
          target="_blank"
          rel="noopener noreferrer"
          className="border border-[#ddd] hover:border-[#bbb] text-[#555] font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
        >
          Falar no WhatsApp
        </a>
      </div>
    </div>
  )
}
