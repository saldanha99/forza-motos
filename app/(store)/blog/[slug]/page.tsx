export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await prisma.blogPost.findUnique({ where: { slug: params.slug, publicado: true } })
  if (!post) return { title: 'Post não encontrado' }
  return { title: post.titulo, description: post.conteudo.replace(/<[^>]*>/g, '').slice(0, 160) }
}

export default async function BlogPostPage({ params }: Props) {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug, publicado: true },
  })

  if (!post) notFound()

  const relacionados = await prisma.blogPost.findMany({
    where: { publicado: true, id: { not: post.id } },
    take: 3,
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/blog" className="inline-flex items-center gap-2 text-dim hover:text-ink text-sm mb-8 transition-colors">
        <ArrowLeft size={16} /> Voltar ao blog
      </Link>

      <article>
        <p className="text-xs text-faint mb-3">{formatDate(post.createdAt)} · por {post.autor}</p>
        <h1 className="font-grotesk font-bold text-4xl md:text-5xl text-ink mb-8 leading-tight">{post.titulo}</h1>

        {post.capaUrl && (
          <div className="relative aspect-video rounded-xl overflow-hidden mb-10 bg-surface">
            <Image src={post.capaUrl} alt={post.titulo} fill className="object-cover" />
          </div>
        )}

        <div
          className="prose dark:prose-invert prose-zinc max-w-none prose-headings:font-grotesk prose-a:text-vermelho prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: post.conteudo }}
        />
      </article>

      {relacionados.length > 0 && (
        <section className="mt-16 pt-10 border-t border-line">
          <h2 className="font-grotesk font-bold text-2xl text-ink mb-6">Posts relacionados</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relacionados.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`}>
                <div className="bg-card border border-line hover:border-line-hi rounded-xl p-4 transition-all">
                  <p className="text-xs text-faint mb-2">{formatDate(p.createdAt)}</p>
                  <h3 className="font-grotesk font-semibold text-ink hover:text-vermelho transition-colors line-clamp-2">
                    {p.titulo}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
