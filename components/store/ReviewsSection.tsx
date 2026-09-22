import { ExternalLink, Star } from 'lucide-react'

const GOOGLE_MAPS_URL = 'https://maps.google.com/?q=R.+Funilense,+110+Campinas+SP'

export function ReviewsSection() {
  return (
    <section
      aria-labelledby="avaliacoes-google"
      className="border-y border-black/10 bg-[#fafafa] px-6 py-14 dark:border-white/10 dark:bg-[#121212] md:px-12"
    >
      <div className="mx-auto max-w-[880px] rounded-2xl border border-black/10 bg-white p-7 text-center shadow-sm dark:border-white/10 dark:bg-[#191919] sm:p-10">
        <div className="mx-auto mb-4 flex w-fit gap-1 text-amber-500" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} size={20} fill="currentColor" />
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d42b2b]">Reputação pública</p>
        <h2 id="avaliacoes-google" className="mt-2 font-barlow text-3xl font-bold text-[#111] dark:text-white md:text-4xl">
          Confira as avaliações no Google
        </h2>
        <p className="mx-auto mt-3 max-w-xl font-inter text-sm leading-relaxed text-[#666] dark:text-[#aaa]">
          Veja comentários publicados por clientes no perfil da Forza Motos. As informações são exibidas e atualizadas diretamente pelo Google.
        </p>
        <a
          href={GOOGLE_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#d42b2b] px-5 font-barlow text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#b82222]"
        >
          Ver avaliações no Google <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
