export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Plus } from 'lucide-react'

export const metadata = { title: 'Blog / CMS — Forza Admin' }

export default async function BlogAdminPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Blog / CMS</h1>
        <Link
          href="/admin/blog/novo"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-brand-accent/20"
        >
          <Plus size={16} /> Novo post
        </Link>
      </div>

      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-border/20 bg-white/[0.01]">
            <tr className="text-xs text-brand-muted uppercase tracking-widest">
              <th className="text-left px-6 py-3 font-medium">Título</th>
              <th className="text-left px-6 py-3 font-medium">Autor</th>
              <th className="text-left px-6 py-3 font-medium">Status</th>
              <th className="text-left px-6 py-3 font-medium">Data</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-brand-border/10 hover:bg-white/[0.04] transition-colors">
                <td className="px-6 py-3.5 text-brand-text font-medium">{p.titulo}</td>
                <td className="px-6 py-3.5 text-brand-muted">{p.autor}</td>
                <td className="px-6 py-3.5">
                  {p.publicado ? <Badge variant="success">Publicado</Badge> : <Badge variant="warning">Rascunho</Badge>}
                </td>
                <td className="px-6 py-3.5 text-brand-muted">{formatDate(p.createdAt)}</td>
                <td className="px-6 py-3.5">
                  <Link href={`/admin/blog/${p.id}`} className="text-xs text-brand-muted hover:text-brand-text transition-colors">
                    Editar →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
