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
      <div className="mb-10">
        <h1 className="font-grotesk font-bold text-3xl text-ink mb-1">Blog</h1>
        <p className="text-dim">Dicas, novidades e tutoriais sobre motos e manutenção.</p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-faint">
          <p className="text-4xl mb-4">📝</p>
          <p className="text-dim">Nenhum post publicado ainda.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article className="bg-card border border-line hover:border-line-hi rounded-xl overflow-hidden transition-all hover:shadow-md group">
                  <div className="aspect-video bg-surface overflow-hidden">
                    {post.capaUrl ? (
                      <Image
                        src={post.capaUrl}
                        alt={post.titulo}
                        width={600}
                        height={340}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-faint text-4xl">🏍️</div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-faint mb-2">{formatDate(post.createdAt)} · {post.autor}</p>
                    <h2 className="font-grotesk font-bold text-base text-ink group-hover:text-vermelho transition-colors line-clamp-2">
                      {post.titulo}
                    </h2>
                    <p className="text-sm text-dim mt-2 line-clamp-3 leading-relaxed">
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
                  className={`w-9 h-9 flex items-center justify-center rounded-md text-sm transition-colors font-medium ${
                    p === page
                      ? 'bg-vermelho text-white'
                      : 'bg-card border border-line text-dim hover:border-line-hi hover:text-ink'
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
