/**
 * Breadcrumbs visuais + JSON-LD automático.
 *
 *   <Breadcrumbs items={[
 *     { name: 'Início', url: '/' },
 *     { name: 'Pneus', url: '/pneus' },
 *     { name: 'Pirelli Diablo Rosso', url: '/produtos/pirelli-diablo-rosso' },
 *   ]} />
 */
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { JsonLd } from './JsonLd'
import { breadcrumbSchema } from '@/lib/seo/schema'

interface BreadcrumbItem {
  name: string
  url: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema(items)} />
      <nav aria-label="Breadcrumb" className="py-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1
            return (
              <li key={item.url} className="flex items-center gap-1.5">
                {isLast ? (
                  <span className="text-foreground font-medium" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link
                      href={item.url}
                      className="hover:text-foreground transition-colors"
                    >
                      {item.name}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
