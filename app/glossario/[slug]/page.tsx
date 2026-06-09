export const dynamic = 'force-dynamic'
import { buscarTermoPorSlug, incrementarViews } from '@/lib/glossario/queries'
import { produtosRelacionadosAoTermo } from '@/lib/glossario/produtos-relacionados'
import { dividirConteudoNoMeio } from '@/lib/glossario/dividir-conteudo'
import { SEO_CONFIG } from '@/lib/seo/config'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { GlossarioSidebar } from '@/components/glossario/GlossarioSidebar'
import { ProdutosRelacionadosGlossario } from '@/components/glossario/ProdutosRelacionadosGlossario'
import { CtaAgendamento } from '@/components/glossario/CtaAgendamento'
import { CtaOfertaInline } from '@/components/glossario/CtaOfertaInline'
import { CtaWhatsapp } from '@/components/glossario/CtaWhatsapp'

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

  // Produtos da loja relacionados ao termo (para grid + sidebar)
  const produtos = await produtosRelacionadosAoTermo(termo.termo, 8)
  const produtosSidebar = produtos.slice(0, 3).map((p) => ({
    id: p.id,
    nome: p.nome,
    slug: p.slug,
    preco: p.preco,
    precoPromocional: p.precoPromocional,
    imagem: p.imagens[0] ?? null,
    marca: p.marca,
  }))

  // Divide o conteúdo para injetar um CTA no meio do artigo
  const [parte1, parte2] = dividirConteudoNoMeio(termo.conteudo)

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

  const proseStyle = {
    // Tema claro — texto escuro legível sobre fundo branco
    '--tw-prose-body': '#3f3f46',
    '--tw-prose-headings': '#111111',
    '--tw-prose-bold': '#111111',
    '--tw-prose-links': '#d42b2b',
    '--tw-prose-bullets': '#d42b2b',
  } as React.CSSProperties

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
        {/* Breadcrumb */}
        <nav className="text-sm mb-8 flex items-center gap-2 text-[#888]">
          <Link href="/" className="hover:text-[#d42b2b] transition-colors">{cfg.siteName}</Link>
          <span>/</span>
          <Link href="/glossario" className="hover:text-[#d42b2b] transition-colors">Glossário</Link>
          <span>/</span>
          <span className="text-[#111] font-medium">{termo.termo}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
          {/* ── Conteúdo principal ── */}
          <main className="min-w-0">
            {/* Header */}
            <div className="mb-8">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white font-black text-lg mb-4"
                style={{ background: 'linear-gradient(135deg,#d42b2b,#8a1818)' }}>
                {termo.letra}
              </span>
              <h1 className="font-barlow font-black text-4xl text-[#111] mb-3">{termo.termo}</h1>
              {termo.resumo && (
                <p className="text-lg leading-relaxed text-[#555]">{termo.resumo}</p>
              )}
            </div>

            {/* Conteúdo — parte 1 */}
            <article
              className="prose prose-lg max-w-none prose-headings:font-barlow prose-headings:font-bold"
              style={proseStyle}
              dangerouslySetInnerHTML={{ __html: parte1 }}
            />

            {/* CTA injetado no meio do artigo */}
            {parte2 ? <CtaAgendamento /> : null}

            {/* Conteúdo — parte 2 (se houve divisão) */}
            {parte2 && (
              <article
                className="prose prose-lg max-w-none prose-headings:font-barlow prose-headings:font-bold"
                style={proseStyle}
                dangerouslySetInnerHTML={{ __html: parte2 }}
              />
            )}

            {/* Banner de oferta */}
            <CtaOfertaInline />

            {/* WhatsApp contextual */}
            <CtaWhatsapp termo={termo.termo} />

            {/* Se o conteúdo era curto demais para dividir, mostra o agendamento aqui */}
            {!parte2 ? <CtaAgendamento /> : null}

            {/* Produtos relacionados na loja */}
            <ProdutosRelacionadosGlossario produtos={produtos} />

            {/* Rodapé */}
            <div className="mt-12 pt-6 border-t border-[#eee]">
              <Link href="/glossario" className="text-sm text-[#888] hover:text-[#d42b2b] transition-colors">
                ← Voltar ao Glossário
              </Link>
            </div>
          </main>

          {/* ── Sidebar de anúncios (sticky em telas grandes) ── */}
          <GlossarioSidebar produtos={produtosSidebar} />
        </div>
      </div>
    </>
  )
}
