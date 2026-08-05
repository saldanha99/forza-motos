import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { obterEventoPirelli } from '@/lib/evento-pirelli'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leads — Evento Pirelli' }

export default async function LeadsEventoPirelliPage() {
  const evento = await obterEventoPirelli()
  const visitantes = await prisma.eventoPirelliVisitante.findMany({
    where: { eventoId: evento.id }, orderBy: { createdAt: 'desc' },
    include: { tentativaQuiz: true, participacaoFoto: true, balanceamento: true, canecaBrinde: true },
  })
  return <main className="max-w-6xl mx-auto pb-20"><Link href="/admin/evento-pirelli" className="text-sm text-brand-muted">← Evento Pirelli</Link><h1 className="font-barlow font-black text-4xl text-brand-text mt-2">Leads e balanceamento</h1><p className="text-brand-muted mt-1">Lista em ordem de cadastro. Cada visitante já foi registrado como lead de origem EVENTO_PIRELLI.</p><div className="mt-5 overflow-x-auto rounded-2xl bg-brand-surface border border-brand-border"><table className="w-full text-sm"><thead className="text-left text-brand-muted border-b border-brand-border"><tr><th className="p-3">Visitante</th><th className="p-3">Caneca</th><th className="p-3">Quiz</th><th className="p-3">Foto</th><th className="p-3">Balanceamento</th><th className="p-3">Consentimento marketing</th></tr></thead><tbody>{visitantes.map((v) => <tr key={v.id} className="border-b border-brand-border/50 text-brand-text"><td className="p-3"><b>{v.nomeCompleto}</b><br/><span className="text-brand-muted">{v.whatsapp} {v.instagram ? `· @${v.instagram}` : ''}</span></td><td className="p-3">{v.canecaBrinde?.status ?? '—'}</td><td className="p-3">{v.tentativaQuiz ? `${v.tentativaQuiz.pontuacao}/${v.tentativaQuiz.pontuacaoMaxima}` : '—'}</td><td className="p-3">{v.participacaoFoto?.status ?? '—'}</td><td className="p-3">{v.balanceamento ? `${v.balanceamento.status}${v.balanceamento.horarioPreferido ? ` · ${v.balanceamento.horarioPreferido}` : ''}` : '—'}</td><td className="p-3">{v.consentimentoMarketingEm ? <span className="text-brand-success">Sim</span> : <span className="text-brand-muted">Não</span>}</td></tr>)}</tbody></table>{!visitantes.length && <p className="p-6 text-brand-muted">Ainda não há leads.</p>}</div></main>
}
