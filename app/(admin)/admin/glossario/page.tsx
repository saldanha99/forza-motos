export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Upload, Clock, BookOpen, AlertCircle } from 'lucide-react'
import { GlossarioAdminClient } from '@/components/admin/GlossarioAdminClient'

export const metadata = { title: 'Glossário — Forza Admin' }

export default async function GlossarioAdminPage() {
  const [termos, totalPublicados, totalPendentes, jobsPendentes] = await Promise.all([
    prisma.glossaryTerm.findMany({
      orderBy: [{ letra: 'asc' }, { termo: 'asc' }],
      take: 500,
      select: {
        id: true, termo: true, slug: true, letra: true, nicho: true,
        categoria: true, publicado: true, revisado: true, origem: true,
        seoTitle: true, resumo: true, views: true, createdAt: true, updatedAt: true,
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
          <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Glossário</h1>
          <p className="text-brand-muted text-sm mt-1">
            Gerador Ninja via IA · Multi-provider · SEO automático · Indexação Google/Bing
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/glossario/importar"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-brand-border/40 text-brand-text px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Upload size={15} /> Importar CSV
          </Link>
          <Link href="/admin/glossario/jobs"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-brand-border/40 text-brand-text px-4 py-2 rounded-xl text-sm font-semibold transition-all relative">
            <Clock size={15} /> Jobs
            {jobsPendentes > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-accent text-white text-[10px] font-bold">
                {jobsPendentes}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="admin-glass !bg-black/20 border border-emerald-500/20 rounded-2xl p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/0">
          <p className="text-brand-muted text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <BookOpen size={11} /> Publicados
          </p>
          <p className="text-3xl font-bold text-brand-text">{totalPublicados}</p>
        </div>
        <div className="admin-glass !bg-black/20 border border-amber-500/20 rounded-2xl p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/0">
          <p className="text-brand-muted text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <AlertCircle size={11} /> Pendentes
          </p>
          <p className="text-3xl font-bold text-brand-text">{totalPendentes}</p>
        </div>
        <div className="admin-glass !bg-black/20 border border-sky-500/20 rounded-2xl p-4 bg-gradient-to-br from-sky-500/10 to-sky-500/0">
          <p className="text-brand-muted text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <Clock size={11} /> Fila
          </p>
          <p className="text-3xl font-bold text-brand-text">{jobsPendentes}</p>
        </div>
      </div>

      {/* Client interativo */}
      <GlossarioAdminClient initialTermos={termos as any} />
    </div>
  )
}
