import Link from 'next/link'
import { ProductCard } from '@/components/store/ProductCard'
import { ShoppingBag, ArrowRight } from 'lucide-react'
import type { ProdutoRelacionado } from '@/lib/glossario/produtos-relacionados'

/**
 * Grid de produtos da loja relacionados ao termo do glossário.
 * Reaproveita o ProductCard do e-commerce (mesma UX de carrinho/preço).
 * Renderizado no fim do conteúdo para converter o tráfego SEO em vendas.
 */
export function ProdutosRelacionadosGlossario({
  produtos,
}: {
  produtos: ProdutoRelacionado[]
}) {
  if (!produtos || produtos.length === 0) return null

  return (
    <section className="mt-14">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg,#d42b2b,#8a1818)' }}
          >
            <ShoppingBag size={17} />
          </span>
          <h2 className="font-barlow font-black text-xl text-[#111]">
            Produtos relacionados na loja
          </h2>
        </div>
        <Link
          href="/produtos"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-[#d42b2b] hover:gap-2.5 transition-all"
        >
          Ver todos <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {produtos.slice(0, 8).map((produto) => (
          <ProductCard key={produto.id} produto={produto} />
        ))}
      </div>

      <Link
        href="/produtos"
        className="sm:hidden mt-5 flex items-center justify-center gap-2 rounded-full py-3 font-bold text-sm text-white"
        style={{ background: '#d42b2b' }}
      >
        Ver todos os produtos <ArrowRight size={15} />
      </Link>
    </section>
  )
}
