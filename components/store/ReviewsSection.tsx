'use client'

import Script from 'next/script'
import { SITE_URL, SITE_NAME } from '@/lib/schema'

// Schema.org mantido para SEO — atualiza conforme o Google My Business
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

export function ReviewsSection() {
  return (
    <>
      {/* Schema.org para SEO */}
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
          {/* Título da seção */}
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

          {/* Widget Trustindex — carrega reviews reais do Google */}
          <div className="trustindex-widget-wrapper">
            <div
              data-widget-id="a40011271054968da4061533db9"
              className="trustindex-widget"
            />
          </div>
        </div>
      </section>

      {/* Script Trustindex carregado após hydration */}
      <Script
        src="https://cdn.trustindex.io/loader.js?a40011271054968da4061533db9"
        strategy="lazyOnload"
      />
    </>
  )
}
