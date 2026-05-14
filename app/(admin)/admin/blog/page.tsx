export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Plus } from 'lucide-react'

export const metadata = { title: 'Blog Admin' }

export default async function BlogAdminPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-rajdhani font-bold text-3xl text-white">Blog / CMS</h1>
        <Link href="/admin/blog/novo" className="inline-flex items-center gap-2 bg-vermelho hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors">
          <Plus size={16} /> Novo post
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950">
            <tr className="text-xs text-zinc-500 uppercase tracking-wide">
              <th className="text-left px-5 py-3">Título</th>
              <th className="text-left px-5 py-3">Autor</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">Data</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                <td className="px-5 py-3 text-white font-medium">{p.titulo}</td>
                <td className="px-5 py-3 text-zinc-400">{p.autor}</td>
                <td className="px-5 py-3">
                  {p.publicado ? <Badge variant="success">Publicado</Badge> : <Badge variant="warning">Rascunho</Badge>}
                </td>
                <td className="px-5 py-3 text-zinc-500">{formatDate(p.createdAt)}</td>
                <td className="px-5 py-3">
                  <Link href={`/admin/blog/${p.id}`} className="text-xs text-zinc-500 hover:text-white">
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
