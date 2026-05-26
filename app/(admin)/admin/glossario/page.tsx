export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import {
  Sparkles,
  Upload,
  Clock,
  BookOpen,
  Eye,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export const metadata = { title: 'Glossário — Forza Admin' }

export default async function GlossarioAdminPage() {
  const [termos, totalPublicados, totalRascunho, jobsPendentes] = await Promise.all([
    prisma.glossaryTerm.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        termo: true,
        slug: true,
        letra: true,
        categoria: true,
        publicado: true,
        revisado: true,
        origem: true,
        views: true,
        createdAt: true,
      },
    }),
    prisma.glossaryTerm.count({ where: { publicado: true } }),
    prisma.glossaryTerm.count({ where: { publicado: false } }),
    prisma.glossaryJob.count({ where: { status: 'PENDENTE' } }),
  ])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">
            Glossário
          </h1>
          <p className="text-brand-muted text-sm mt-1">
            Termos técnicos com geração via IA (Gemini/OpenAI) e SEO automático
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/glossario/novo"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-brand-accent/20"
          >
            <Sparkles size={16} /> Gerar via IA
          </Link>
          <Link
            href="/admin/glossario/importar"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-brand-border/40 text-brand-text px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            <Upload size={16} /> Importar CSV
          </Link>
          <Link
            href="/admin/glossario/jobs"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-brand-border/40 text-brand-text px-4 py-2 rounded-xl text-sm font-semibold transition-all relative"
          >
            <Clock size={16} /> Fila de jobs
            {jobsPendentes > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-accent text-white text-[10px] font-bold">
                {jobsPendentes}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          icon={<BookOpen size={20} />}
          label="Publicados"
          value={totalPublicados}
          tone="success"
        />
        <KpiCard
          icon={<AlertCircle size={20} />}
          label="Rascunhos"
          value={totalRascunho}
          tone="warning"
        />
        <KpiCard
          icon={<Clock size={20} />}
          label="Fila"
          value={jobsPendentes}
          tone="info"
        />
      </div>

      {/* Tabela */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-border/20 bg-white/[0.01]">
            <tr className="text-xs text-brand-muted uppercase tracking-widest">
              <th className="text-left px-6 py-3 font-medium">Termo</th>
              <th className="text-left px-4 py-3 font-medium">Categoria</th>
              <th className="text-left px-4 py-3 font-medium">Origem</th>
              <th className="text-left px-4 py-3 font-medium">Views</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Criado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {termos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-brand-muted">
                  <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
                  Nenhum termo ainda.{' '}
                  <Link href="/admin/glossario/novo" className="text-brand-accent hover:underline">
                    Crie o primeiro
                  </Link>
                </td>
              </tr>
            )}
            {termos.map((t) => (
              <tr
                key={t.id}
                className="border-b border-brand-border/10 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-accent/10 text-brand-accent text-[11px] font-bold border border-brand-accent/20">
                      {t.letra}
                    </span>
                    <span className="font-medium text-brand-text">{t.termo}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-brand-muted">{t.categoria || '—'}</td>
                <td className="px-4 py-4">
                  <OrigemBadge origem={t.origem} />
                </td>
                <td className="px-4 py-4 text-brand-muted text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Eye size={12} /> {t.views}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge publicado={t.publicado} revisado={t.revisado} />
                </td>
                <td className="px-4 py-4 text-brand-muted text-xs">
                  {formatDate(t.createdAt)}
                </td>
                <td className="px-4 py-4 text-right">
                  <Link
                    href={`/glossario/${t.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-brand-muted hover:text-brand-accent"
                  >
                    Ver <ExternalLink size={11} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-brand-muted mt-3">
        Exibindo os 100 termos mais recentes. Total publicados: {totalPublicados}.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers visuais
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'success' | 'warning' | 'info'
}) {
  const cores = {
    success: 'from-emerald-500/10 to-emerald-500/0 text-emerald-400 border-emerald-500/20',
    warning: 'from-amber-500/10 to-amber-500/0 text-amber-400 border-amber-500/20',
    info: 'from-sky-500/10 to-sky-500/0 text-sky-400 border-sky-500/20',
  }[tone]
  return (
    <div
      className={`admin-glass !bg-black/20 border rounded-2xl p-5 bg-gradient-to-br ${cores}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-brand-muted text-xs uppercase tracking-widest font-medium">
          {label}
        </span>
        <span className="opacity-60">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-brand-text">{value}</div>
    </div>
  )
}

function StatusBadge({ publicado, revisado }: { publicado: boolean; revisado: boolean }) {
  if (publicado) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 size={11} /> Publicado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <AlertCircle size={11} /> {revisado ? 'Revisado' : 'Rascunho'}
    </span>
  )
}

function OrigemBadge({ origem }: { origem: string }) {
  const map: Record<string, { label: string; classe: string }> = {
    MANUAL: { label: 'Manual', classe: 'bg-white/5 text-brand-muted border-brand-border/30' },
    AI_GEMINI: {
      label: '✨ Gemini',
      classe: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    AI_OPENAI: {
      label: '✨ OpenAI',
      classe: 'bg-green-500/10 text-green-400 border-green-500/20',
    },
    CSV_IMPORT: {
      label: '📤 CSV',
      classe: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
  }
  const cfg = map[origem] || map.MANUAL
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border ${cfg.classe}`}
    >
      {cfg.label}
    </span>
  )
}
