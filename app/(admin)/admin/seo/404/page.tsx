export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn, formatDate } from '@/lib/utils'
import {
  Badge, Card, EmptyState, PageHeader, Tabela,
  TD_CELULA, THEAD_TH, TR_LINHA,
} from '@/components/admin/ui/primitives'

export const metadata = { title: 'Monitor de 404 — Forza Admin' }

export default async function NotFoundMonitorPage() {
  const [naoResolvidos, resolvidos] = await Promise.all([
    prisma.seoNotFoundLog.findMany({
      where: { resolvido: false },
      orderBy: { hits: 'desc' },
      take: 100,
    }),
    prisma.seoNotFoundLog.count({ where: { resolvido: true } }),
  ])

  return (
    <div>
      <Link
        href="/admin/seo"
        className="mb-4 inline-flex items-center gap-2 text-sm text-brand-muted transition-colors hover:text-brand-accent"
      >
        <ArrowLeft size={14} /> Voltar ao SEO Dashboard
      </Link>

      <PageHeader
        titulo="Monitor de 404"
        descricao={`Toda URL acessada que não existe mais no site vira um registro aqui, agrupado por quantidade de acessos. ${resolvidos} já foram resolvidos com redirect.`}
      />

      <Card className="mb-4 p-4 text-sm text-brand-muted">
        <strong className="text-brand-text">Como resolver:</strong> para cada 404 frequente, crie
        um redirect 301 em{' '}
        <Link href="/admin/seo/redirects" className="text-brand-accent hover:underline">
          Redirects
        </Link>{' '}
        apontando para a URL correta. Depois marque aqui como resolvido.
      </Card>

      {naoResolvidos.length === 0 ? (
        <EmptyState
          icone={CheckCircle2}
          titulo="Nenhum 404 não resolvido"
          descricao="Um registro aparece aqui sempre que alguém acessa, em produção, uma URL do site que não existe mais."
        />
      ) : (
        <Tabela
          cabecalho={
            <>
              <th className={THEAD_TH}>Path</th>
              <th className={THEAD_TH}>Hits</th>
              <th className={THEAD_TH}>Referer</th>
              <th className={THEAD_TH}>Último acesso</th>
              <th className={THEAD_TH}>Primeiro</th>
            </>
          }
        >
          {naoResolvidos.map((p) => (
            <tr key={p.id} className={TR_LINHA}>
              <td
                className={cn(TD_CELULA, 'max-w-md truncate font-mono text-xs text-brand-text')}
                title={p.path}
              >
                {p.path}
              </td>
              <td className={TD_CELULA}>
                <Badge tom={p.hits > 20 ? 'danger' : p.hits > 5 ? 'warning' : 'neutro'}>
                  <AlertTriangle size={11} /> {p.hits}×
                </Badge>
              </td>
              <td
                className={cn(TD_CELULA, 'max-w-xs truncate text-xs text-brand-muted')}
                title={p.referer || ''}
              >
                {p.referer || '—'}
              </td>
              <td className={cn(TD_CELULA, 'text-xs text-brand-muted')}>
                {formatDate(p.ultimoAcesso)}
              </td>
              <td className={cn(TD_CELULA, 'text-xs text-brand-muted')}>
                {formatDate(p.createdAt)}
              </td>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  )
}
