export const dynamic = 'force-dynamic'
import { listarTermosPublicados } from '@/lib/glossario/queries'
import { SEO_CONFIG } from '@/lib/seo/config'
import Link from 'next/link'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Glossário — ${SEO_CONFIG.siteName}`,
    description: `Glossário completo de ${SEO_CONFIG.niche || 'termos'} com definições detalhadas.`,
    alternates: { canonical: `${SEO_CONFIG.siteUrl.replace(/\/+$/, '')}/glossario` },
    // Verificação do Search Console (token em SEO_CONFIG.googleSiteVerification)
    // → injeta <meta name="google-site-verification"> via Metadata API do Next.
    ...(SEO_CONFIG.googleSiteVerification
      ? { verification: { google: SEO_CONFIG.googleSiteVerification } }
      : {}),
  }
}

export default async function GlossarioPage() {
  const termos = await listarTermosPublicados()

  const porLetra = termos.reduce<Record<string, typeof termos>>((acc, t) => {
    if (!acc[t.letra]) acc[t.letra] = []
    acc[t.letra].push(t)
    return acc
  }, {})

  const letras = Object.keys(porLetra).sort()

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="font-barlow font-black text-4xl text-[#111] mb-2">{SEO_CONFIG.siteName} — Glossário</h1>
      <p className="text-lg mb-10 text-[#666]">
        {termos.length} termos{SEO_CONFIG.niche ? ` sobre ${SEO_CONFIG.niche}` : ''}
      </p>

      {/* Índice A-Z */}
      <div className="flex flex-wrap gap-2 mb-10">
        {letras.map((l) => (
          <a key={l} href={`#letra-${l}`}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all hover:brightness-95"
            style={{ background: 'rgba(212,43,43,0.10)', color: '#d42b2b' }}>
            {l}
          </a>
        ))}
      </div>

      {/* Termos por letra */}
      {letras.map((letra) => (
        <section key={letra} id={`letra-${letra}`} className="mb-10">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black"
              style={{ background: 'linear-gradient(135deg,#d42b2b,#8a1818)' }}>
              {letra}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {porLetra[letra].map((t) => (
              <Link key={t.id} href={`/glossario/${t.slug}`}
                className="rounded-xl p-4 border border-[#eee] bg-white hover:border-[#d42b2b]/40 hover:shadow-md transition-all group">
                <h3 className="font-semibold text-[#111] group-hover:text-[#d42b2b] transition-colors">{t.termo}</h3>
                {t.resumo && <p className="text-xs mt-1 line-clamp-2 text-[#888]">{t.resumo}</p>}
              </Link>
            ))}
          </div>
        </section>
      ))}

      {termos.length === 0 && (
        <p className="text-center py-20 text-[#888]">
          Nenhum verbete publicado ainda.
        </p>
      )}
    </div>
  )
}
