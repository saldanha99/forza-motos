export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Upload, Clock, BookOpen, AlertCircle } from 'lucide-react'
import { GlossarioAdminClient } from '@/components/admin/GlossarioAdminClient'
import { KpiCard } from '@/components/admin/KpiCard'
import { BotaoLink, PageHeader } from '@/components/admin/ui/primitives'

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
      <PageHeader
        titulo="Glossário"
        descricao="Termos gerados por IA viram páginas indexadas no site — cada verbete publicado soma para o SEO da loja."
        acoes={
          <>
            <BotaoLink href="/admin/glossario/importar" variante="secundario">
              <Upload size={15} /> Importar CSV
            </BotaoLink>
            <BotaoLink href="/admin/glossario/jobs" variante="secundario">
              <Clock size={15} /> Jobs
              {jobsPendentes > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-brand-accent text-brand-on-accent text-[10px] font-bold">
                  {jobsPendentes}
                </span>
              )}
            </BotaoLink>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Publicados" value={totalPublicados} icon={BookOpen} tom="success" />
        <KpiCard label="Pendentes" value={totalPendentes} icon={AlertCircle} tom="warning" />
        <KpiCard label="Fila de geração" value={jobsPendentes} icon={Clock} tom="info" href="/admin/glossario/jobs" />
      </div>

      {/* Client interativo */}
      <GlossarioAdminClient initialTermos={termos as any} />
    </div>
  )
}
