export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { cn, formatDate } from '@/lib/utils'
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { KpiCard } from '@/components/admin/KpiCard'
import type { TomStatus } from '@/lib/admin/status'
import {
  Badge, EmptyState, PageHeader, Tabela, THEAD_TH, TD_CELULA,
} from '@/components/admin/ui/primitives'

export const metadata = { title: 'Fila de jobs — Forza Admin' }

const JOB_STATUS_TOM: Record<string, TomStatus> = {
  PENDENTE: 'warning',
  PROCESSANDO: 'info',
  CONCLUIDO: 'success',
  ERRO: 'danger',
}

const JOB_STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  PROCESSANDO: 'Processando',
  CONCLUIDO: 'Concluído',
  ERRO: 'Erro',
}

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

      <PageHeader
        titulo="Fila de geração"
        descricao="O cron processa até 5 jobs por hora — falhas tentam 3x antes de virar erro permanente."
      />

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Clock} label="Pendentes" value={totais['PENDENTE'] || 0} tom="warning" />
        <KpiCard icon={Loader2} label="Processando" value={totais['PROCESSANDO'] || 0} tom="info" />
        <KpiCard icon={CheckCircle2} label="Concluídos" value={totais['CONCLUIDO'] || 0} tom="success" />
        <KpiCard icon={XCircle} label="Com erro" value={totais['ERRO'] || 0} tom="danger" />
      </div>

      {/* Tabela */}
      <Tabela
        cabecalho={
          <>
            <th className={THEAD_TH}>Termo</th>
            <th className={THEAD_TH}>Modelo</th>
            <th className={THEAD_TH}>Tentativas</th>
            <th className={THEAD_TH}>Agendado</th>
            <th className={THEAD_TH}>Status</th>
            <th className={THEAD_TH}>Erro</th>
            <th className={THEAD_TH}>Criado</th>
          </>
        }
      >
        {jobs.length === 0 && (
          <tr>
            <td colSpan={7}>
              <EmptyState
                compacto
                icone={Clock}
                titulo="Nenhum job na fila"
                descricao="Importe um CSV ou gere um termo via IA — cada envio vira um job aqui até ser processado pelo cron."
                className="border-0"
                acao={
                  <Link
                    href="/admin/glossario/importar"
                    className="text-xs font-semibold text-brand-accent hover:underline"
                  >
                    Importar CSV →
                  </Link>
                }
              />
            </td>
          </tr>
        )}
        {jobs.map((j) => (
          <tr key={j.id} className="border-b border-brand-hair last:border-0 transition-colors hover:bg-brand-tint-1">
            <td className={cn(TD_CELULA, 'font-medium text-brand-text')}>{j.titulo}</td>
            <td className={cn(TD_CELULA, 'text-brand-muted text-xs font-mono')}>{j.modelo}</td>
            <td className={cn(TD_CELULA, 'text-brand-muted')}>{j.tentativas}/3</td>
            <td className={cn(TD_CELULA, 'text-brand-muted text-xs')}>
              {j.agendadoPara ? formatDate(j.agendadoPara) : 'imediato'}
            </td>
            <td className={TD_CELULA}>
              <Badge tom={JOB_STATUS_TOM[j.status] ?? 'neutro'}>
                {JOB_STATUS_LABEL[j.status] ?? j.status}
              </Badge>
            </td>
            <td className={cn(TD_CELULA, 'text-brand-danger text-xs max-w-xs truncate')}>
              {j.erro || '—'}
            </td>
            <td className={cn(TD_CELULA, 'text-brand-muted text-xs')}>{formatDate(j.createdAt)}</td>
          </tr>
        ))}
      </Tabela>
    </div>
  )
}
