import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo/metadata'
import { buscarTermoPorSlug, termosRelacionados } from '@/lib/glossario/queries'
import { JsonLd } from '@/components/seo/JsonLd'
import { definedTermSchema, breadcrumbSchema } from '@/lib/seo/schema'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { SEO_CONFIG } from '@/lib/seo/config'
import { GlossarioSidebar } from '@/components/glossario/GlossarioSidebar'
import { prisma } from '@/lib/prisma'
import { ChevronRight, BookOpen, MessageCircle, ShoppingBag } from 'lucide-react'

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

// Busca produtos para os anúncios da sidebar (destaque > promoção > recentes)
async function buscarProdutosAnuncio() {
  const produtos = await prisma.product.findMany({
    where: { ativo: true, estoque: { gt: 0 } },
    orderBy: [{ destaque: 'desc' }, { createdAt: 'desc' }],
    take: 4,
    select: {
      id: true, nome: true, slug: true, preco: true, precoPromocional: true,
      imagens: true, marca: true,
    },
  })
  return produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    slug: p.slug,
    preco: Number(p.preco),
    precoPromocional: p.precoPromocional ? Number(p.precoPromocional) : null,
    imagem: Array.isArray(p.imagens) && p.imagens.length > 0 ? String(p.imagens[0]) : null,
    marca: p.marca,
  }))
}

export default async function TermoPage({ params }: PageProps) {
  const termo = await buscarTermoPorSlug(params.slug)
  if (!termo || !termo.publicado) notFound()

  const [relacionados, produtosAnuncio] = await Promise.all([
    termosRelacionados(termo.slug, termo.categoria),
    buscarProdutosAnuncio(),
  ])

  const whatsLink = `https://wa.me/5519974049445?text=${encodeURIComponent(
    `Olá! Vi o termo "${termo.termo}" no glossário e tenho interesse em produtos.`
  )}`

  return (
    <>
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

      {/* Faixa de banner topo — anúncio do e-commerce */}
      <div className="border-b border-[#eee]" style={{ background: 'linear-gradient(90deg,rgba(212,43,43,0.06),transparent)' }}>
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-[#555] flex items-center gap-2">
            <ShoppingBag size={14} className="text-[#d42b2b] shrink-0" />
            <span className="font-medium text-[#111]">Precisa de peças ou pneus?</span>
            <span className="hidden sm:inline">Frete grátis acima de R$499 para SP.</span>
          </p>
          <Link href="/produtos" className="text-xs font-bold text-white px-3 py-1.5 rounded-lg shrink-0" style={{ background: '#d42b2b' }}>
            Ver loja
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <Breadcrumbs
          items={[
            { name: 'Início', url: '/' },
            { name: 'Glossário', url: '/glossario' },
            { name: termo.termo, url: `/glossario/${termo.slug}` },
          ]}
        />

        {/* Grid premium: conteúdo + sidebar de anúncios */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-4">

          {/* ── Conteúdo ── */}
          <article className="min-w-0">
            <header className="mb-6 pb-6 border-b border-[#eee]">
              <div className="inline-flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg font-barlow font-black text-white" style={{ background: 'linear-gradient(135deg,#d42b2b,#8a1818)' }}>
                  {termo.letra}
                </span>
                {termo.categoria && (
                  <span className="text-xs font-semibold text-[#888] uppercase tracking-wide px-2 py-1 rounded-md" style={{ background: '#f5f5f5' }}>
                    {termo.categoria}
                  </span>
                )}
                <span className="text-xs text-[#bbb] flex items-center gap-1">
                  <BookOpen size={12} /> Glossário
                </span>
              </div>
              <h1 className="font-barlow font-black text-[32px] md:text-[44px] text-[#111] leading-[1.05] tracking-[-0.5px]">
                {termo.termo}
              </h1>
              {termo.resumo && (
                <p className="text-lg text-[#555] mt-4 leading-relaxed">{termo.resumo}</p>
              )}
            </header>

            {/* CTA inline antes do conteúdo */}
            <div className="mb-6 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'rgba(212,43,43,0.04)', border: '1px solid rgba(212,43,43,0.12)' }}>
              <p className="text-sm text-[#444]">
                💡 Dúvida sobre <strong className="text-[#111]">{termo.termo}</strong>? Fale com um especialista.
              </p>
              <a href={whatsLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-lg shrink-0" style={{ background: '#25d366' }}>
                <MessageCircle size={13} /> WhatsApp
              </a>
            </div>

            {/* Corpo do verbete */}
            <div
              className="prose prose-neutral max-w-none prose-headings:font-barlow prose-headings:font-bold prose-headings:text-[#111] prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3 prose-p:text-[#444] prose-p:leading-relaxed prose-a:text-[#d42b2b] prose-strong:text-[#111]"
              dangerouslySetInnerHTML={{ __html: termo.conteudo }}
            />

            {/* Anúncio inline pós-conteúdo */}
            <div className="mt-10 rounded-2xl overflow-hidden text-white p-6 relative" style={{ background: 'linear-gradient(120deg,#1a1a1a,#2d2d2d)' }}>
              <div className="absolute right-0 top-0 w-32 h-32 rounded-full opacity-10" style={{ background: '#d42b2b' }} />
              <p className="font-barlow font-black text-2xl leading-tight relative">Pronto para comprar?</p>
              <p className="text-sm text-white/70 mt-2 relative">Pneus, peças e acessórios com instalação rápida na Forza Motos.</p>
              <div className="flex gap-3 mt-4 relative flex-wrap">
                <Link href="/produtos" className="inline-flex items-center gap-1.5 font-bold text-sm text-white px-5 py-2.5 rounded-xl" style={{ background: '#d42b2b' }}>
                  <ShoppingBag size={15} /> Ver produtos
                </Link>
                <Link href="/servicos" className="inline-flex items-center gap-1.5 font-bold text-sm px-5 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 transition-colors">
                  Agendar serviço
                </Link>
              </div>
            </div>

            {/* Termos relacionados */}
            {relacionados.length > 0 && (
              <section className="mt-12 pt-8 border-t border-[#eee]">
                <h2 className="font-barlow font-bold text-xl text-[#111] mb-4">Termos relacionados</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relacionados.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/glossario/${r.slug}`} className="flex items-start gap-2 p-3 rounded-xl border border-[#eee] hover:border-[#d42b2b]/40 hover:bg-[#fafafa] transition-all group">
                        <ChevronRight size={16} className="text-[#d42b2b] mt-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        <div className="min-w-0">
                          <div className="font-medium text-[#111] text-sm">{r.termo}</div>
                          {r.resumo && <p className="text-xs text-[#888] line-clamp-2 mt-0.5">{r.resumo}</p>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="mt-10 pt-6 border-t border-[#eee]">
              <Link href="/glossario" className="text-sm text-[#888] hover:text-[#d42b2b] transition-colors">
                ← Voltar ao glossário completo
              </Link>
            </footer>
          </article>

          {/* ── Sidebar de anúncios ── */}
          <div className="lg:block">
            <GlossarioSidebar produtos={produtosAnuncio} />
          </div>
        </div>
      </div>
    </>
  )
}
