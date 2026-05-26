import Link from 'next/link'
import { log404 } from '@/lib/seo/not-found-logger'

export default async function NotFound() {
  // Loga 404 para o admin identificar links quebrados e oportunidades de redirect
  await log404()

  return (
    <main className="container mx-auto px-4 py-20 text-center max-w-2xl">
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-4">Página não encontrada</h2>
      <p className="text-muted-foreground mb-8">
        O link que você seguiu pode estar quebrado ou a página foi removida.
        Confira algumas opções abaixo:
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium"
        >
          Página inicial
        </Link>
        <Link
          href="/produtos"
          className="px-4 py-2 border rounded-md font-medium"
        >
          Ver produtos
        </Link>
        <Link
          href="/glossario"
          className="px-4 py-2 border rounded-md font-medium"
        >
          Glossário
        </Link>
        <Link
          href="/blog"
          className="px-4 py-2 border rounded-md font-medium"
        >
          Blog
        </Link>
      </div>
    </main>
  )
}
