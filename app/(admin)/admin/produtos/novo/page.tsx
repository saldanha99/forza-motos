import { ProdutoForm } from '@/components/admin/ProdutoForm'

export const metadata = { title: 'Novo Produto — Forza Admin' }

export default function NovoProdutoPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight mb-8">Novo Produto</h1>
      <ProdutoForm />
    </div>
  )
}
