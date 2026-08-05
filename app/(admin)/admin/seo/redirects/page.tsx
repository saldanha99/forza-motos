export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Link2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn, formatDate } from '@/lib/utils'
import {
  Badge, Card, EmptyState, PageHeader, Tabela,
  TD_CELULA, THEAD_TH, TR_LINHA,
} from '@/components/admin/ui/primitives'

export const metadata = { title: 'Redirects 301 — Forza Admin' }

export default async function RedirectsPage() {
  const redirects = await prisma.seoRedirect.findMany({
    orderBy: { hits: 'desc' },
    take: 200,
  })

  return (
    <div>
      <Link
        href="/admin/seo"
        className="mb-4 inline-flex items-center gap-2 text-sm text-brand-muted transition-colors hover:text-brand-accent"
      >
        <ArrowLeft size={14} /> Voltar ao SEO Dashboard
      </Link>

      <PageHeader
        titulo="Redirects 301"
        descricao="Redirecionamentos de URL antiga para URL nova — cadastre ao mudar um slug para preservar o SEO acumulado."
      />

      <Card className="mb-4 p-4 text-sm text-brand-muted">
        <strong className="text-brand-text">Como ativar:</strong> os redirects ficam no banco mas
        ainda não estão sendo aplicados pelo middleware (Edge Runtime + Prisma exige Prisma
        Accelerate). Veja <code className="text-brand-accent">lib/seo/redirects.ts</code> e o
        comentário no topo do <code className="text-brand-accent">middleware.ts</code> para ativar.
      </Card>

      {redirects.length === 0 ? (
        <EmptyState
          icone={Link2}
          titulo="Nenhum redirect cadastrado"
          descricao="Um redirect aparece aqui depois de criado via Prisma Studio — ainda não há formulário dedicado nesta tela."
        />
      ) : (
        <Tabela
          cabecalho={
            <>
              <th className={THEAD_TH}>De</th>
              <th className={THEAD_TH}>Para</th>
              <th className={THEAD_TH}>Status</th>
              <th className={THEAD_TH}>Hits</th>
              <th className={THEAD_TH}>Ativo</th>
              <th className={THEAD_TH}>Criado</th>
            </>
          }
        >
          {redirects.map((r) => (
            <tr key={r.id} className={TR_LINHA}>
              <td className={cn(TD_CELULA, 'font-mono text-xs text-brand-text')}>{r.from}</td>
              <td className={cn(TD_CELULA, 'font-mono text-xs text-brand-muted')}>
                <ArrowRight size={11} className="mr-1 inline" />
                {r.to}
              </td>
              <td className={TD_CELULA}>
                <Badge tom="info">{r.statusCode}</Badge>
              </td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>{r.hits}</td>
              <td className={TD_CELULA}>
                {r.ativo ? <Badge tom="success">Ativo</Badge> : <Badge tom="neutro">Off</Badge>}
              </td>
              <td className={cn(TD_CELULA, 'text-xs text-brand-muted')}>{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  )
}
