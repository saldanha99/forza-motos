import Link from 'next/link'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo/metadata'
import { listarPorLetra, letrasDisponiveis } from '@/lib/glossario/queries'
import { JsonLd } from '@/components/seo/JsonLd'
import { definedTermSetSchema, breadcrumbSchema } from '@/lib/seo/schema'
import { Breadcrumbs } from '@/components/seo/Breadcrumbs'
import { SEO_CONFIG } from '@/lib/seo/config'

export const metadata: Metadata = buildMetadata({
  title: 'Glossário — Termos Técnicos de Motos',
  description:
    'Glossário completo com termos técnicos sobre motos, peças, pneus, óleos e serviços. Tire suas dúvidas com a Forza Motos.',
  path: '/glossario',
})

// ISR — revalida a cada 1 hora
export const revalidate = 3600

export default async function GlossarioPage() {
  const porLetra = await listarPorLetra()
  const totalTermos = Object.values(porLetra).reduce((acc, l) => acc + l.length, 0)
  const letras = letrasDisponiveis()

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
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

      <Breadcrumbs
        items={[
          { name: 'Início', url: '/' },
          { name: 'Glossário', url: '/glossario' },
        ]}
      />

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Glossário de Motos</h1>
        <p className="text-muted-foreground max-w-2xl">
          {totalTermos} termos sobre o universo das motos: peças, manutenção, pneus,
          óleos e tudo o que você precisa saber.
        </p>
      </header>

      {/* Navegação A-Z */}
      <nav className="sticky top-16 z-10 bg-background/80 backdrop-blur-sm border-y py-3 mb-8">
        <ul className="flex flex-wrap gap-1.5 justify-center">
          {letras.map((letra) => {
            const temTermos = (porLetra[letra]?.length ?? 0) > 0
            return (
              <li key={letra}>
                <a
                  href={temTermos ? `#letra-${letra}` : undefined}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                    temTermos
                      ? 'bg-secondary hover:bg-primary hover:text-primary-foreground'
                      : 'text-muted-foreground/40 cursor-not-allowed'
                  }`}
                  aria-disabled={!temTermos}
                >
                  {letra}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Lista por letra */}
      <div className="space-y-10">
        {letras.map((letra) => {
          const termos = porLetra[letra] || []
          if (termos.length === 0) return null
          return (
            <section key={letra} id={`letra-${letra}`} className="scroll-mt-32">
              <h2 className="text-2xl font-bold mb-4 pb-2 border-b">{letra}</h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {termos.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/glossario/${t.slug}`}
                      className="block p-3 rounded-md border hover:border-primary hover:shadow-sm transition-all"
                    >
                      <div className="font-medium">{t.termo}</div>
                      {t.resumo && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {t.resumo}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
