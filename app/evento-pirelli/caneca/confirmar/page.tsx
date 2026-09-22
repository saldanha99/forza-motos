import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Gift, ShoppingBag } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { extrairCodigoQrEvento } from '@/lib/eventos/qr-pirelli'
import { confirmarNomeCaneca } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Confirmação da caneca | Pirelli × Forza Motos',
  description: 'Consulte sua compra ou prêmio e confirme o nome para gravação.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

const ORIGENS: Record<string, string> = {
  QUIZ_PERFEITO: 'Prêmio de vencedor do quiz',
  COMPRA_PNEUS: 'Caneca conquistada na compra de pneus',
  FOTO_VENCEDORA: 'Prêmio da ação de fotos',
  MANUAL: 'Caneca liberada pela equipe',
}

const STATUS: Record<string, string> = {
  PENDENTE: 'aguardando gravação',
  EM_GRAVACAO: 'em gravação',
  PRONTA: 'pronta para retirada',
  ENTREGUE: 'entregue',
  CANCELADA: 'cancelada',
}

const ERROS: Record<string, string> = {
  acesso: 'Este link de confirmação é inválido.',
  direito: 'Ainda não existe um prêmio ou benefício de caneca confirmado para este acesso.',
  nome: 'Revise o nome da gravação. Use de 2 a 20 caracteres, sem emoji.',
  producao: 'A gravação já começou e o nome não pode mais ser alterado. Fale com a equipe no estande.',
}

export default async function ConfirmarCanecaEventoPirelliPage({ searchParams }: {
  searchParams: Promise<{ token?: string; confirmado?: string; erro?: string }>
}) {
  const parametros = await searchParams
  const token = extrairCodigoQrEvento(parametros.token ?? '')
  const visitante = token
    ? await prisma.eventoPirelliVisitante.findUnique({
        where: { codigoQr: token },
        select: {
          nomeCompleto: true,
          nomeGravacao: true,
          evento: { select: { limiteNomeGravacao: true } },
          elegibilidadesCaneca: {
            where: { revogadoEm: null },
            select: { id: true, origem: true },
            orderBy: { validadoEm: 'asc' },
          },
          canecaBrinde: {
            select: { status: true, nomeGravacaoSnapshot: true },
          },
          comprasCaneca: {
            where: { pagamentoConfirmadoEm: { not: null } },
            select: { id: true, quantidade: true, nomeGravacaoSnapshot: true, status: true },
            orderBy: { registradoEm: 'asc' },
          },
        },
      })
    : null

  const temBrinde = Boolean(visitante?.elegibilidadesCaneca.length)
  const temCompraPendente = Boolean(visitante?.comprasCaneca.some((compra) => compra.status === 'PENDENTE'))
  const podeEditarNome = Boolean(
    (temBrinde && (!visitante?.canecaBrinde || ['PENDENTE', 'CANCELADA'].includes(visitante.canecaBrinde.status)))
    || temCompraPendente,
  )
  const erro = parametros.erro ? ERROS[parametros.erro] ?? ERROS.acesso : null

  return (
    <main className="min-h-screen bg-[#09090a] px-5 py-10 text-white antialiased sm:py-16">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-[#111114] p-6 shadow-2xl sm:p-10">
        <Link href="/evento-pirelli" className="text-sm font-bold text-white/50 transition hover:text-white">← Experiência Pirelli × Forza</Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-[#f5b82e]">Confirmação segura</p>
        <h1 className="mt-2 font-barlow text-4xl font-black uppercase leading-none sm:text-5xl">Sua caneca</h1>

        {!visitante ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-200">Este link é inválido ou não pertence a um cadastro ativo.</p>
        ) : (
          <div className="mt-7 space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-wider text-white/40">Participante</p>
              <p className="mt-1 font-barlow text-2xl font-black">{visitante.nomeCompleto}</p>
            </div>

            {parametros.confirmado === '1' ? (
              <p role="status" className="flex gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-200"><CheckCircle2 className="shrink-0" size={20} /> Nome confirmado. A equipe já consegue vê-lo na fila de gravação.</p>
            ) : null}
            {erro ? <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-200">{erro}</p> : null}

            {temBrinde ? (
              <div className="rounded-2xl border border-[#f5b82e]/25 bg-[#f5b82e]/10 p-5">
                <p className="flex items-center gap-2 font-bold text-[#ffd369]"><Gift size={19} /> Caneca conquistada</p>
                <p className="mt-2 text-sm text-white/65">{visitante.elegibilidadesCaneca.map((item) => ORIGENS[item.origem] ?? item.origem).join(' · ')}</p>
                {visitante.canecaBrinde ? <p className="mt-2 text-sm font-semibold text-white">Status: {STATUS[visitante.canecaBrinde.status] ?? visitante.canecaBrinde.status}</p> : null}
              </div>
            ) : null}

            {visitante.comprasCaneca.map((compra) => (
              <div key={compra.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="flex items-center gap-2 font-bold"><ShoppingBag size={19} className="text-[#f5b82e]" /> Compra confirmada</p>
                <p className="mt-2 text-sm text-white/65">{compra.quantidade}x caneca · {compra.nomeGravacaoSnapshot ? `gravação “${compra.nomeGravacaoSnapshot}”` : 'aguardando confirmação do nome'}</p>
                <p className="mt-1 text-sm font-semibold text-white">Status: {STATUS[compra.status] ?? compra.status}</p>
              </div>
            ))}

            {!temBrinde && !visitante.comprasCaneca.length ? (
              <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">Ainda não existe compra ou prêmio de caneca confirmado para este cadastro.</p>
            ) : null}

            {podeEditarNome && token ? (
              <form action={confirmarNomeCaneca} className="rounded-2xl border border-white/10 p-5">
                <input type="hidden" name="token" value={token} />
                <label htmlFor="nomeGravacao" className="text-xs font-black uppercase tracking-wider text-white/55">Nome para gravação</label>
                <input id="nomeGravacao" name="nomeGravacao" required minLength={2} maxLength={visitante.evento.limiteNomeGravacao} defaultValue={visitante.nomeGravacao ?? visitante.canecaBrinde?.nomeGravacaoSnapshot ?? ''} autoComplete="off" className="mt-2 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-4 text-lg font-bold uppercase text-white outline-none transition focus:border-[#f5b82e]" />
                <p className="mt-2 text-xs text-white/40">Confira com atenção. Depois que a gravação começar, o nome não poderá ser alterado.</p>
                <button className="mt-5 min-h-14 w-full rounded-2xl bg-[#dc1f26] px-5 font-barlow text-sm font-black uppercase tracking-wider text-white transition hover:bg-[#ef2930]">Confirmar nome</button>
              </form>
            ) : null}
          </div>
        )}
      </section>
    </main>
  )
}
