export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Card, PageHeader } from '@/components/admin/ui/primitives'
import { RedirectsManager } from './RedirectsManager'

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

      <RedirectsManager redirectsIniciais={redirects} />
    </div>
  )
}
