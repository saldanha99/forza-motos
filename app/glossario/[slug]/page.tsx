export const dynamic = 'force-dynamic'
import { buscarTermoPorSlug, incrementarViews } from '@/lib/glossario/queries'
import { SEO_CONFIG } from '@/lib/seo/config'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const termo = await buscarTermoPorSlug(params.slug)
  if (!termo) return { title: 'Não encontrado' }
  const base = SEO_CONFIG.siteUrl.replace(/\/+$/, '')
  return {
    title:       termo.seoTitle || `${termo.termo} — ${SEO_CONFIG.siteName}`,
    description: termo.resumo   || `Saiba o que é ${termo.termo} no glossário de ${SEO_CONFIG.siteName}.`,
    alternates:  { canonical: `${base}/glossario/${termo.slug}` },
    openGraph: {
      title:       termo.seoTitle || termo.termo,
      description: termo.resumo || '',
      url:         `${base}/glossario/${termo.slug}`,
    },
  }
}

export default async function TermoPage({ params }: Props) {
  const termo = await buscarTermoPorSlug(params.slug)
  if (!termo) notFound()
  const cfg = SEO_CONFIG

  // Incrementa views em background
  incrementarViews(params.slug)

  // JSON-LD DefinedTerm
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: termo.termo,
    description: termo.resumo || '',
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: `Glossário — ${cfg.siteName}`,
      url: `${cfg.siteUrl}/glossario`,
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm mb-8 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <Link href="/" className="hover:text-white transition-colors">{cfg.siteName}</Link>
          <span>/</span>
          <Link href="/glossario" className="hover:text-white transition-colors">Glossário</Link>
          <span>/</span>
          <span className="text-white">{termo.termo}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white font-black text-lg mb-4"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            {termo.letra}
          </span>
          <h1 className="text-4xl font-bold text-white mb-3">{termo.termo}</h1>
          {termo.resumo && (
            <p className="text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>{termo.resumo}</p>
          )}
        </div>

        {/* Conteúdo */}
        <article
          className="prose prose-invert prose-lg max-w-none"
          style={{ '--tw-prose-body': '#94a3b8', '--tw-prose-headings': '#e2e8f0' } as any}
          dangerouslySetInnerHTML={{ __html: termo.conteudo }}
        />

        {/* Rodapé */}
        <div className="mt-12 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
          <Link href="/glossario" className="text-sm hover:text-white transition-colors" style={{ color: 'var(--muted)' }}>
            ← Voltar ao Glossário
          </Link>
        </div>
      </div>
    </>
  )
}
