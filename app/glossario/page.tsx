import Link from 'next/link'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo/metadata'
import { listarPorLetra, letrasDisponiveis } from '@/lib/glossario/queries'
import { JsonLd } from '@/components/seo/JsonLd'
import { definedTermSetSchema, breadcrumbSchema } from '@/lib/seo/schema'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { SEO_CONFIG } from '@/lib/seo/config'
import { GlossarioSidebar } from '@/components/glossario/GlossarioSidebar'
import { prisma } from '@/lib/prisma'
import { BookOpen, ChevronRight, ShoppingBag } from 'lucide-react'

export const metadata: Metadata = buildMetadata({
  title: 'Glossário — Termos Técnicos de Motos',
  description:
    'Glossário completo com termos técnicos sobre motos, peças, pneus, óleos e serviços. Tire suas dúvidas com a Forza Motos.',
  path: '/glossario',
})

export const revalidate = 3600

async function buscarProdutosAnuncio() {
  const produtos = await prisma.product.findMany({
    where: { ativo: true, estoque: { gt: 0 } },
    orderBy: [{ destaque: 'desc' }, { createdAt: 'desc' }],
    take: 4,
    select: { id: true, nome: true, slug: true, preco: true, precoPromocional: true, imagens: true, marca: true },
  })
  return produtos.map((p) => ({
    id: p.id, nome: p.nome, slug: p.slug,
    preco: Number(p.preco),
    precoPromocional: p.precoPromocional ? Number(p.precoPromocional) : null,
    imagem: Array.isArray(p.imagens) && p.imagens.length > 0 ? String(p.imagens[0]) : null,
    marca: p.marca,
  }))
}

export default async function GlossarioPage() {
  const [porLetra, produtosAnuncio] = await Promise.all([
    listarPorLetra(),
    buscarProdutosAnuncio(),
  ])
  const totalTermos = Object.values(porLetra).reduce((acc, l) => acc + l.length, 0)
  const letras = letrasDisponiveis()

  return (
    <>
      <JsonLd
        data={[
          definedTermSetSchema({
            name: 'Glossário Forza Motos',
            description: metadata.description as string,
            url: `${SEO_CONFIG.siteUrl}/glossario`,
            termsCount: totalTermos,
          }),
          breadcrumbSchema([
            { name: 'Início', url: '/' },
            { name: 'Glossário', url: '/glossario' },
          ]),
        ]}
      />

      {/* Banner topo — anúncio do e-commerce */}
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

      {/* Hero do glossário */}
      <div className="border-b border-[#eee]" style={{ background: 'linear-gradient(135deg,#fafafa,#fff)' }}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <Breadcrumbs
            items={[
              { name: 'Início', url: '/' },
              { name: 'Glossário', url: '/glossario' },
            ]}
          />
          <div className="flex items-center gap-2 mt-4 mb-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#d42b2b,#8a1818)' }}>
              <BookOpen size={20} />
            </span>
            <span className="text-xs font-semibold text-[#888] uppercase tracking-widest">Forza Motos</span>
          </div>
          <h1 className="font-barlow font-black text-[36px] md:text-[52px] text-[#111] leading-[1.02] tracking-[-1px]">
            Glossário de Motos
          </h1>
          <p className="text-lg text-[#555] mt-3 max-w-2xl">
            <strong className="text-[#d42b2b]">{totalTermos} termos</strong> sobre o universo das motos: peças,
            manutenção, pneus, óleos e tudo o que você precisa saber.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Navegação A-Z */}
        <nav className="sticky top-16 z-10 backdrop-blur-sm border border-[#eee] rounded-2xl py-3 px-3 mb-8" style={{ background: 'rgba(255,255,255,0.9)' }}>
          <ul className="flex flex-wrap gap-1.5 justify-center">
            {letras.map((letra) => {
              const temTermos = (porLetra[letra]?.length ?? 0) > 0
              return (
                <li key={letra}>
                  <a
                    href={temTermos ? `#letra-${letra}` : undefined}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                      temTermos
                        ? 'text-[#111] hover:text-white'
                        : 'text-[#ccc] cursor-not-allowed'
                    }`}
                    style={temTermos ? { background: '#f5f5f5' } : {}}
                    aria-disabled={!temTermos}
                  >
                    {letra}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Grid: lista + sidebar de anúncios */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">

          {/* Lista por letra */}
          <div className="space-y-10 min-w-0">
            {letras.map((letra) => {
              const termos = porLetra[letra] || []
              if (termos.length === 0) return null
              return (
                <section key={letra} id={`letra-${letra}`} className="scroll-mt-32">
                  <h2 className="font-barlow font-black text-3xl text-[#111] mb-4 flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-white text-lg" style={{ background: 'linear-gradient(135deg,#d42b2b,#8a1818)' }}>
                      {letra}
                    </span>
                    <span className="flex-1 h-px bg-[#eee]" />
                  </h2>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {termos.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/glossario/${t.slug}`}
                          className="flex items-start gap-2 p-3.5 rounded-xl border border-[#eee] hover:border-[#d42b2b]/40 hover:bg-[#fafafa] transition-all group"
                        >
                          <ChevronRight size={16} className="text-[#d42b2b] mt-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          <div className="min-w-0">
                            <div className="font-semibold text-[#111] group-hover:text-[#d42b2b] transition-colors">{t.termo}</div>
                            {t.resumo && (
                              <p className="text-sm text-[#888] mt-0.5 line-clamp-2">{t.resumo}</p>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>

          {/* Sidebar de anúncios */}
          <div className="lg:block">
            <GlossarioSidebar produtos={produtosAnuncio} />
          </div>
        </div>
      </div>
    </>
  )
}
