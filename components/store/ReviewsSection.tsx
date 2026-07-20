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

const WIDGET_ID = '73043017787d1877e976b42d67e'

export function ReviewsSection() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (document.querySelector(`script[src*="${WIDGET_ID}"]`)) return

    const script = document.createElement('script')
    script.src = `https://cdn.trustindex.io/loader.js?${WIDGET_ID}`
    script.async = true
    script.defer = true
    containerRef.current.appendChild(script)
  }, [])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(AGGREGATE_RATING) }}
      />

      <section
        className="bg-[#fafafa] dark:bg-[#121212]"
        style={{
          borderTop: '1px solid rgba(128,128,128,0.15)',
          borderBottom: '1px solid rgba(128,128,128,0.15)',
          padding: '56px 0',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="text-center mb-10">
            <h2
              className="font-barlow font-bold text-3xl md:text-4xl text-[#111] dark:text-white mb-2"
              style={{ letterSpacing: '-0.5px' }}
            >
              O que dizem nossos clientes
            </h2>
            <p className="text-[#666] dark:text-[#aaa] text-sm font-inter">
              Avaliações reais do Google · Forza Motos Campinas
            </p>
          </div>

          {/* Container do Widget Trustindex */}
          <div ref={containerRef} className="min-h-[350px] w-full flex justify-center items-center">
            <iframe
              src={`https://cdn.trustindex.io/amp-widget.html#${WIDGET_ID}`}
              width="100%"
              height="353"
              style={{ border: 'none', overflow: 'hidden' }}
              title="Avaliações do Google - Forza Motos"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        </div>
      </section>
    </>
  )
}
