import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { getBreadcrumbSchema } from '@/lib/schema'

export interface BreadcrumbItem {
  name: string
  url: string
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  // Adiciona Home automaticamente como primeiro item
  const fullItems: BreadcrumbItem[] = [
    { name: 'Home', url: '/' },
    ...items,
  ]

  const schema = getBreadcrumbSchema(fullItems)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <nav
        aria-label="Breadcrumb"
        className="text-xs text-[#888] font-inter py-3"
      >
        <ol className="flex items-center flex-wrap gap-1">
          {fullItems.map((item, idx) => {
            const isLast = idx === fullItems.length - 1
            return (
              <li key={item.url} className="flex items-center gap-1">
                {idx === 0 ? (
                  <Link
                    href={item.url}
                    className="flex items-center hover:text-[#d42b2b] transition-colors"
                    aria-label="Voltar para Home"
                  >
                    <Home size={12} />
                  </Link>
                ) : isLast ? (
                  <span className="text-[#333] font-medium" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.url}
                    className="hover:text-[#d42b2b] transition-colors"
                  >
                    {item.name}
                  </Link>
                )}
                {!isLast && <ChevronRight size={11} className="text-[#bbb]" />}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
