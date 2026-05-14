'use client'

import { useEffect, useRef } from 'react'
import { SITE_URL, SITE_NAME } from '@/lib/schema'

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
}

const WIDGET_ID = 'a40011271054968da4061533db9'

export function ReviewsSection() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Evita carregar duas vezes
    if (document.querySelector(`script[src*="${WIDGET_ID}"]`)) return

    const script = document.createElement('script')
    script.src = `https://cdn.trustindex.io/loader.js?${WIDGET_ID}`
    script.async = true
    script.defer = true
    // Injeta o script logo após o container para o Trustindex encontrá-lo
    containerRef.current?.parentElement?.appendChild(script)
  }, [])

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
            <p className="text-[#888] text-sm font-inter">
              Avaliações reais do Google · Forza Motos Campinas
            </p>
          </div>

          {/* Container onde o Trustindex vai injetar o widget */}
          <div ref={containerRef} id={`trustindex-widget-${WIDGET_ID}`} />
        </div>
      </section>
    </>
  )
}
