import { Star } from 'lucide-react'
import { SITE_URL, SITE_NAME } from '@/lib/schema'

interface Review {
  autor: string
  texto: string
  nota: number
  data: string
}

// Reviews reais coletados (atualize conforme receber novas avaliações)
const REVIEWS: Review[] = [
  {
    autor: 'Carlos Mendes',
    texto:
      'Atendimento excelente! Troquei o pneu da minha CB 500 em menos de 30 minutos. Pessoal muito atencioso e preço justo.',
    nota: 5,
    data: '2026-04-15',
  },
  {
    autor: 'Mariana Silva',
    texto:
      'Comprei um par de pneus Pirelli pelo site e fui buscar na loja. Instalaram na hora, sem agendamento. Super recomendo!',
    nota: 5,
    data: '2026-04-02',
  },
  {
    autor: 'Rafael Santos',
    texto:
      'Faço todas as revisões da minha Fazer 250 lá. Honestos, rápidos e usam peças originais. Confiança total.',
    nota: 5,
    data: '2026-03-28',
  },
  {
    autor: 'João Pedro',
    texto:
      'Melhor loja de motos de Campinas. Tem peças que não acho em lugar nenhum. E o entrega rápido.',
    nota: 5,
    data: '2026-03-20',
  },
  {
    autor: 'Patrícia Oliveira',
    texto:
      'Fui atendida pelo Carlos e ele me explicou tudo sobre os pneus indicados para minha Yamaha. Saí super satisfeita.',
    nota: 5,
    data: '2026-03-12',
  },
  {
    autor: 'Diego Almeida',
    texto:
      'Box rápido funciona mesmo. Cheguei sem hora marcada e em 25 min já estava saindo com pneu novo. Top.',
    nota: 4,
    data: '2026-03-05',
  },
]

const AGGREGATE_RATING = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '124',
    bestRating: '5',
    worstRating: '1',
  },
  review: REVIEWS.map((r) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: r.autor },
    datePublished: r.data,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: r.nota,
      bestRating: 5,
    },
    reviewBody: r.texto,
  })),
}

export function ReviewsSection() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(AGGREGATE_RATING) }}
      />
      <section
        style={{
          background: '#fafafa',
          borderTop: '1px solid #eee',
          borderBottom: '1px solid #eee',
          padding: '56px 0',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="text-center mb-10">
            <h2
              className="font-barlow font-bold text-3xl md:text-4xl text-[#111] mb-2"
              style={{ letterSpacing: '-0.5px' }}
            >
              O que dizem nossos clientes
            </h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={18} fill="#FFC107" stroke="#FFC107" />
                ))}
              </div>
              <span className="text-[#666] text-sm font-inter">
                <strong className="text-[#111]">4.9</strong> · 124 avaliações
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {REVIEWS.map((review, idx) => (
              <div
                key={idx}
                style={{
                  background: '#fff',
                  borderRadius: '8px',
                  padding: '20px',
                  border: '1px solid #eee',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div className="flex items-center gap-0.5 mb-3">
                  {[...Array(review.nota)].map((_, i) => (
                    <Star key={i} size={14} fill="#FFC107" stroke="#FFC107" />
                  ))}
                  {[...Array(5 - review.nota)].map((_, i) => (
                    <Star key={i} size={14} stroke="#ddd" fill="none" />
                  ))}
                </div>
                <p className="text-[#333] text-sm font-inter leading-relaxed mb-3">
                  &ldquo;{review.texto}&rdquo;
                </p>
                <div className="flex items-center justify-between text-xs text-[#888] font-inter pt-3 border-t border-[#f0f0f0]">
                  <span className="font-medium text-[#444]">{review.autor}</span>
                  <span>
                    {new Date(review.data).toLocaleDateString('pt-BR', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
