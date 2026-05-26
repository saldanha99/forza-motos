/**
 * Renderiza um (ou múltiplos) blocos JSON-LD no <head>.
 *
 * Server Component — coloque dentro de qualquer page.tsx ou layout.tsx.
 *
 *   <JsonLd data={productSchema({...})} />
 *   <JsonLd data={[organizationSchema(), breadcrumbSchema(...)]} />
 */
interface JsonLdProps {
  data: object | object[]
}

export function JsonLd({ data }: JsonLdProps) {
  const items = Array.isArray(data) ? data : [data]
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  )
}
