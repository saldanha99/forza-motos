export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn, formatDate } from '@/lib/utils'
import {
  Badge, BotaoLink, EmptyState, PageHeader, Tabela,
  TD_CELULA, THEAD_TH, TR_LINHA,
} from '@/components/admin/ui/primitives'

export const metadata = { title: 'Blog / CMS — Forza Admin' }

export default async function BlogAdminPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div>
      <PageHeader
        titulo="Blog / CMS"
        descricao="Posts do blog da loja — publicados aparecem no site, rascunhos ficam só aqui."
        acoes={
          <BotaoLink href="/admin/blog/novo">
            <Plus size={16} /> Novo post
          </BotaoLink>
        }
      />

      {posts.length === 0 ? (
        <EmptyState
          icone={FileText}
          titulo="Nenhum post ainda"
          descricao="Crie o primeiro post — assim que marcar como publicado, ele aparece no blog da loja."
          acao={<BotaoLink href="/admin/blog/novo">Novo post</BotaoLink>}
        />
      ) : (
        <Tabela
          cabecalho={
            <>
              <th className={THEAD_TH}>Título</th>
              <th className={THEAD_TH}>Autor</th>
              <th className={THEAD_TH}>Status</th>
              <th className={THEAD_TH}>Data</th>
              <th className={THEAD_TH} />
            </>
          }
        >
          {posts.map((p) => (
            <tr key={p.id} className={TR_LINHA}>
              <td className={cn(TD_CELULA, 'font-medium text-brand-text')}>{p.titulo}</td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>{p.autor}</td>
              <td className={TD_CELULA}>
                {p.publicado ? (
                  <Badge tom="success">Publicado</Badge>
                ) : (
                  <Badge tom="warning">Rascunho</Badge>
                )}
              </td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>{formatDate(p.createdAt)}</td>
              <td className={TD_CELULA}>
                <Link
                  href={`/admin/blog/${p.id}`}
                  className="text-xs text-brand-dim transition-colors hover:text-brand-accent"
                >
                  Editar →
                </Link>
              </td>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  )
}
