import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import Image from 'next/image'
import { formatDate } from '@/lib/utils'

export const metadata = { title: 'Blog' }

export default async function BlogPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams.page ?? 1)
  const pageSize = 9

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where: { publicado: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.blogPost.count({ where: { publicado: true } }),
  ])

  const pages = Math.ceil(total / pageSize)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-rajdhani font-bold text-4xl text-white mb-2 uppercase tracking-wide">Blog</h1>
      <p className="text-zinc-500 mb-10">Dicas, novidades e tutoriais sobre motos e manutenção.</p>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-4xl mb-4">📝</p>
          <p>Nenhum post publicado ainda.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-lg overflow-hidden transition-all group">
                  <div className="aspect-video bg-zinc-800 overflow-hidden">
                    {post.capaUrl ? (
                      <Image
                        src={post.capaUrl}
                        alt={post.titulo}
                        width={600}
                        height={340}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-4xl">🏍️</div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-zinc-600 mb-2">{formatDate(post.createdAt)} · {post.autor}</p>
                    <h2 className="font-rajdhani font-bold text-lg text-white group-hover:text-vermelho transition-colors line-clamp-2">
                      {post.titulo}
                    </h2>
                    <p className="text-sm text-zinc-500 mt-2 line-clamp-3">
                      {post.conteudo.replace(/<[^>]*>/g, '').slice(0, 150)}...
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`?page=${p}`}
                  className={`w-9 h-9 flex items-center justify-center rounded text-sm transition-colors ${
                    p === page ? 'bg-vermelho text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
