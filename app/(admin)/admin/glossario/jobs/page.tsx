export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export const metadata = { title: 'Fila de jobs — Forza Admin' }

export default async function JobsPage() {
  const [jobs, counts] = await Promise.all([
    prisma.glossaryJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.glossaryJob.groupBy({
      by: ['status'],
      _count: true,
    }),
  ])

  const totais = Object.fromEntries(counts.map((c) => [c.status, c._count]))

  return (
    <div>
      <Link
        href="/admin/glossario"
        className="inline-flex items-center gap-2 text-sm text-brand-muted hover:text-brand-accent mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Voltar ao glossário
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">
            Fila de geração
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            O cron processa até 5 jobs por hora. Falhas tentam 3x antes de virar
            erro permanente.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatusCard
          icon={<Clock size={20} />}
          label="Pendentes"
          value={totais['PENDENTE'] || 0}
          cor="amber"
        />
        <StatusCard
          icon={<Loader2 size={20} className="animate-spin" />}
          label="Processando"
          value={totais['PROCESSANDO'] || 0}
          cor="sky"
        />
        <StatusCard
          icon={<CheckCircle2 size={20} />}
          label="Concluídos"
          value={totais['CONCLUIDO'] || 0}
          cor="emerald"
        />
        <StatusCard
          icon={<XCircle size={20} />}
          label="Com erro"
          value={totais['ERRO'] || 0}
          cor="rose"
        />
      </div>

      {/* Tabela */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-border/20 bg-white/[0.01]">
            <tr className="text-xs text-brand-muted uppercase tracking-widest">
              <th className="text-left px-6 py-3 font-medium">Termo</th>
              <th className="text-left px-4 py-3 font-medium">Modelo</th>
              <th className="text-left px-4 py-3 font-medium">Tentativas</th>
              <th className="text-left px-4 py-3 font-medium">Agendado</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Erro</th>
              <th className="text-left px-4 py-3 font-medium">Criado</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-brand-muted">
                  Nenhum job na fila. Importe um CSV em{' '}
                  <Link
                    href="/admin/glossario/importar"
                    className="text-brand-accent hover:underline"
                  >
                    Importar CSV
                  </Link>
                </td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr
                key={j.id}
                className="border-b border-brand-border/10 hover:bg-white/[0.02]"
              >
                <td className="px-6 py-3 font-medium text-brand-text">{j.titulo}</td>
                <td className="px-4 py-3 text-brand-muted text-xs font-mono">
                  {j.modelo}
                </td>
                <td className="px-4 py-3 text-brand-muted">{j.tentativas}/3</td>
                <td className="px-4 py-3 text-brand-muted text-xs">
                  {j.agendadoPara ? formatDate(j.agendadoPara) : 'imediato'}
                </td>
                <td className="px-4 py-3">
                  <JobStatusBadge status={j.status} />
                </td>
                <td className="px-4 py-3 text-rose-400 text-xs max-w-xs truncate">
                  {j.erro || '—'}
                </td>
                <td className="px-4 py-3 text-brand-muted text-xs">
                  {formatDate(j.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusCard({
  icon,
  label,
  value,
  cor,
}: {
  icon: React.ReactNode
  label: string
  value: number
  cor: 'amber' | 'sky' | 'emerald' | 'rose'
}) {
  const map = {
    amber: 'text-amber-400 border-amber-500/20 from-amber-500/10',
    sky: 'text-sky-400 border-sky-500/20 from-sky-500/10',
    emerald: 'text-emerald-400 border-emerald-500/20 from-emerald-500/10',
    rose: 'text-rose-400 border-rose-500/20 from-rose-500/10',
  }
  return (
    <div
      className={`admin-glass !bg-black/20 border rounded-2xl p-4 bg-gradient-to-br to-transparent ${map[cor]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-brand-muted text-[11px] uppercase tracking-widest font-medium">
          {label}
        </span>
        <span className="opacity-70">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-brand-text">{value}</div>
    </div>
  )
}

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classe: string }> = {
    PENDENTE: { label: 'Pendente', classe: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    PROCESSANDO: { label: 'Processando', classe: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    CONCLUIDO: { label: 'Concluído', classe: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    ERRO: { label: 'Erro', classe: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  }
  const cfg = map[status] || map.PENDENTE
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border ${cfg.classe}`}
    >
      {cfg.label}
    </span>
  )
}
