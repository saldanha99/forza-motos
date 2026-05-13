'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getFAQSchema } from '@/lib/schema'

export interface FAQItem {
  question: string
  answer: string
}

export function FAQSection({
  title = 'Perguntas frequentes',
  items,
}: {
  title?: string
  items: FAQItem[]
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getFAQSchema(items)) }}
      />
      <section className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <h2
            className="font-barlow font-bold text-3xl md:text-4xl text-[#111] mb-8 text-center"
            style={{ letterSpacing: '-0.5px' }}
          >
            {title}
          </h2>
          <div className="space-y-3">
            {items.map((item, idx) => {
              const isOpen = openIdx === idx
              return (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #eee',
                    borderRadius: '6px',
                    background: isOpen ? '#fafafa' : '#fff',
                    transition: 'all 180ms',
                  }}
                >
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="font-inter font-medium text-[15px] text-[#111]">
                      {item.question}
                    </span>
                    <ChevronDown
                      size={18}
                      className="shrink-0 text-[#888]"
                      style={{
                        transition: 'transform 180ms',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 -mt-1 text-[14px] text-[#444] font-inter leading-relaxed">
                      {item.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
