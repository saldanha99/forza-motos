import { ProdutoForm } from '@/components/admin/ProdutoForm'

export const metadata = { title: 'Novo Produto' }

export default function NovoProdutoPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-8">Novo Produto</h1>
      <ProdutoForm />
    </div>
  )
}
