import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo/metadata'
import { buscarTermoPorSlug, termosRelacionados } from '@/lib/glossario/queries'
import { JsonLd } from '@/components/seo/JsonLd'
import { definedTermSchema, breadcrumbSchema } from '@/lib/seo/schema'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { SEO_CONFIG } from '@/lib/seo/config'

interface PageProps {
  params: { slug: string }
}

export const revalidate = 3600

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const termo = await buscarTermoPorSlug(params.slug)
  if (!termo) return buildMetadata({ title: 'Termo não encontrado', noindex: true })

  return buildMetadata({
    title: `${termo.termo} — Glossário`,
    description:
      termo.resumo ||
      `Saiba o que é ${termo.termo} e como funciona. Glossário Forza Motos.`,
    path: `/glossario/${termo.slug}`,
    image: termo.imagem || undefined,
    type: 'article',
    publishedTime: termo.createdAt.toISOString(),
    modifiedTime: termo.updatedAt.toISOString(),
    author: termo.autor,
    keywords: [termo.termo, termo.categoria, 'glossário', 'moto'].filter(Boolean) as string[],
  })
}

export default async function TermoPage({ params }: PageProps) {
  const termo = await buscarTermoPorSlug(params.slug)
  if (!termo || !termo.publicado) notFound()

  const relacionados = await termosRelacionados(termo.slug, termo.categoria)

  return (
    <article className="container mx-auto px-4 py-8 max-w-3xl">
      <JsonLd
        data={[
          definedTermSchema({
            term: termo.termo,
            definition: termo.resumo || termo.conteudo.replace(/<[^>]+>/g, '').slice(0, 300),
            url: `${SEO_CONFIG.siteUrl}/glossario/${termo.slug}`,
            inDefinedTermSet: {
              name: 'Glossário Forza Motos',
              url: `${SEO_CONFIG.siteUrl}/glossario`,
            },
          }),
          breadcrumbSchema([
            { name: 'Início', url: '/' },
            { name: 'Glossário', url: '/glossario' },
            { name: termo.termo, url: `/glossario/${termo.slug}` },
          ]),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: 'Início', url: '/' },
          { name: 'Glossário', url: '/glossario' },
          { name: termo.termo, url: `/glossario/${termo.slug}` },
        ]}
      />

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground font-bold">
            {termo.letra}
          </span>
          {termo.categoria && (
            <span className="text-sm text-muted-foreground">{termo.categoria}</span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold">{termo.termo}</h1>
        {termo.resumo && (
          <p className="text-lg text-muted-foreground mt-3">{termo.resumo}</p>
        )}
      </header>

      <div
        className="prose prose-neutral dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: termo.conteudo }}
      />

      {relacionados.length > 0 && (
        <section className="mt-12 pt-8 border-t">
          <h2 className="text-xl font-bold mb-4">Termos relacionados</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relacionados.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/glossario/${r.slug}`}
                  className="block p-3 rounded-md border hover:border-primary transition-colors"
                >
                  <div className="font-medium">{r.termo}</div>
                  {r.resumo && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {r.resumo}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-12 pt-6 border-t text-sm text-muted-foreground">
        <Link href="/glossario" className="hover:text-foreground">
          ← Voltar ao glossário
        </Link>
      </footer>
    </article>
  )
}
