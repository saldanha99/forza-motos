export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { AlertTriangle, Calendar, CheckCircle, Clock3, MapPin, XCircle } from 'lucide-react'
import { obterPreferencia } from '@/lib/mercadopago'
import { prisma } from '@/lib/prisma'
import { reconciliarPagamentosEventos } from '@/lib/eventos/reconciliacao'
import { AtualizarStatusEvento } from '@/components/store/AtualizarStatusEvento'
import {
  reservaCheckoutEventoAtiva,
  STATUS_PAGAMENTO_EVENTO_EM_PROCESSAMENTO,
} from '@/lib/eventos/retomada-checkout'

const TOKEN_CONSULTA = /^[A-Za-z0-9_-]{40,60}$/

type AparenciaStatus = {
  titulo: string
  descricao: string
  fundo: string
  cor: string
  Icone: typeof CheckCircle
}

function aparenciaStatus(input: {
  status: 'PENDENTE' | 'PAGO' | 'CANCELADO'
  mpStatus: string | null
  reservaExpiraEm: Date | null
  pagamentoResultadoIncerto: boolean
}): AparenciaStatus {
  if (input.status === 'PAGO') {
    return {
      titulo: 'Inscrição confirmada!',
      descricao: 'Sua vaga está garantida. Enviaremos os próximos detalhes pelo WhatsApp ou e-mail.',
      fundo: 'bg-green-50',
      cor: 'text-green-600',
      Icone: CheckCircle,
    }
  }

  const expirou = Boolean(
    input.reservaExpiraEm &&
    input.reservaExpiraEm <= new Date() &&
    !input.pagamentoResultadoIncerto,
  )
  if (input.status === 'PENDENTE' && !expirou) {
    const tentativaFalhou = input.mpStatus === 'rejected' || input.mpStatus === 'cancelled'
    return {
      titulo: tentativaFalhou ? 'Pagamento não concluído' : 'Pagamento em análise',
      descricao: tentativaFalhou
        ? 'A última tentativa não foi aprovada, mas sua vaga continua reservada por alguns minutos. Você pode tentar novamente com segurança.'
        : 'O Mercado Pago ainda está processando o pagamento. Esta página sempre mostra o status confirmado pelo servidor.',
      fundo: 'bg-yellow-50',
      cor: 'text-yellow-600',
      Icone: Clock3,
    }
  }

  if (input.mpStatus === 'refunded') {
    return {
      titulo: 'Pagamento estornado',
      descricao: 'O pagamento foi devolvido e a vaga não está mais reservada. Fale conosco caso precise de ajuda.',
      fundo: 'bg-orange-50',
      cor: 'text-orange-600',
      Icone: AlertTriangle,
    }
  }
  if (input.mpStatus === 'charged_back') {
    return {
      titulo: 'Pagamento contestado',
      descricao: 'A inscrição foi cancelada após uma contestação do pagamento. Fale conosco para regularizar a situação.',
      fundo: 'bg-orange-50',
      cor: 'text-orange-600',
      Icone: AlertTriangle,
    }
  }

  return {
    titulo: expirou ? 'Reserva expirada' : 'Pagamento não concluído',
    descricao: expirou
      ? 'O prazo para pagar terminou e as vagas foram liberadas. Volte ao evento para iniciar uma nova inscrição.'
      : 'O pagamento foi rejeitado ou cancelado e nenhuma vaga ficou reservada.',
    fundo: 'bg-red-50',
    cor: 'text-red-600',
    Icone: XCircle,
  }
}

export default async function EventoSucessoPage(
  props: {
    searchParams: Promise<{ token?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === 'string' && TOKEN_CONSULTA.test(searchParams.token)
    ? searchParams.token
    : null
  let inscricao = token
      ? await prisma.eventoInscricao.findUnique({
        where: { consultaToken: token },
        include: {
          evento: true,
          tentativasPagamento: {
            where: { status: { in: STATUS_PAGAMENTO_EVENTO_EM_PROCESSAMENTO } },
            select: { id: true },
            take: 1,
          },
        },
      })
    : null

  // O redirect pode vencer o webhook por alguns milissegundos. Confirmamos o
  // estado pela API oficial usando apenas o token opaco persistido, nunca
  // `collection_status`/`payment_id` recebidos na query string.
  if (inscricao?.status === 'PENDENTE') {
    await reconciliarPagamentosEventos({
      inscricaoIds: [inscricao.id],
      limite: 1,
      forcarConsulta: true,
    }).catch((error) => {
      console.warn(`[eventos/sucesso] Reconciliação transitória falhou para ${inscricao!.id}`, error)
    })
    inscricao = await prisma.eventoInscricao.findUnique({
      where: { id: inscricao.id },
      include: {
        evento: true,
        tentativasPagamento: {
          where: { status: { in: STATUS_PAGAMENTO_EVENTO_EM_PROCESSAMENTO } },
          select: { id: true },
          take: 1,
        },
      },
    })
  }

  if (!inscricao) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gray-100">
          <AlertTriangle size={40} className="text-gray-500" />
        </div>
        <h1 className="font-barlow font-black text-3xl text-[#111] mb-3">Inscrição não localizada</h1>
        <p className="text-[#666] text-sm font-inter mb-8 leading-relaxed">
          O link está incompleto ou não corresponde a uma inscrição. Use o link original recebido após o checkout.
        </p>
        <Link
          href="/calendario"
          className="inline-flex bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-xl transition-colors"
        >
          Ver eventos
        </Link>
      </div>
    )
  }

  const visual = aparenciaStatus(inscricao)
  const Icone = visual.Icone
  const reservaAtiva = reservaCheckoutEventoAtiva(inscricao)
  const podeRetomar = reservaAtiva &&
    inscricao.tentativasPagamento.length === 0 &&
    Boolean(inscricao.mpPreferenciaId)
  const preferencia = podeRetomar
    ? await obterPreferencia(inscricao.mpPreferenciaId!).catch(() => null)
    : null

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${visual.fundo}`}>
        <Icone size={40} className={visual.cor} />
      </div>

      <h1 className="font-barlow font-black text-3xl text-[#111] mb-3">{visual.titulo}</h1>

      <AtualizarStatusEvento token={token!} statusInicial={inscricao.status} />

      <div className="bg-[#fafafa] border border-[#eee] rounded-2xl p-5 mb-6 text-left">
        <p className="text-xs text-[#999] uppercase tracking-widest font-semibold mb-3">Detalhes da inscrição</p>
        <p className="font-barlow font-bold text-[#111] text-lg mb-1">{inscricao.evento.titulo}</p>
        <div className="flex items-center gap-2 text-sm text-[#666] font-inter mb-1">
          <Calendar size={13} className="text-[#d42b2b]" />
          {new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          }).format(inscricao.evento.dataInicio)}
        </div>
        <div className="flex items-center gap-2 text-sm text-[#666] font-inter mb-3">
          <MapPin size={13} className="text-[#d42b2b]" />
          {inscricao.evento.local}
        </div>
        <div className="border-t border-[#eee] pt-3 flex justify-between text-sm font-inter">
          <span className="text-[#888]">Participante</span>
          <span className="font-semibold text-[#333]">{inscricao.nome}</span>
        </div>
        {inscricao.motoModelo && (
          <div className="flex justify-between text-sm font-inter mt-1">
            <span className="text-[#888]">Moto</span>
            <span className="font-semibold text-[#333]">{inscricao.motoModelo}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-inter mt-1">
          <span className="text-[#888]">Garupa</span>
          <span className="font-semibold text-[#333]">
            {inscricao.temGarupa ? `Sim (${inscricao.nomeGarupa})` : 'Não (Solo)'}
          </span>
        </div>
        {inscricao.tipoAcomodacao && (
          <div className="flex justify-between text-sm font-inter mt-1">
            <span className="text-[#888]">Quarto / Acomodação</span>
            <span className="font-semibold text-[#333]">{inscricao.tipoAcomodacao}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-inter mt-1">
          <span className="text-[#888]">Vagas</span>
          <span className="font-semibold text-[#333]">{inscricao.quantidade}</span>
        </div>
        {Number(inscricao.total) > 0 && (
          <div className="flex justify-between text-sm font-inter mt-1">
            <span className="text-[#888]">{inscricao.status === 'PAGO' ? 'Total pago' : 'Total'}</span>
            <span className="font-bold text-[#d42b2b]">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(inscricao.total))}
            </span>
          </div>
        )}
      </div>

      <p className="text-[#666] text-sm font-inter mb-8 leading-relaxed">{visual.descricao}</p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {preferencia?.init_point ? (
          <a
            href={preferencia.init_point}
            className="bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-xl transition-colors"
          >
            Retomar pagamento
          </a>
        ) : (
          <Link
            href={inscricao.status === 'CANCELADO' ? `/eventos/${inscricao.evento.slug}` : '/calendario'}
            className="bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-xl transition-colors"
          >
            {inscricao.status === 'CANCELADO' ? 'Tentar novamente' : 'Ver mais eventos'}
          </Link>
        )}
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
