import { ProdutoForm } from '@/components/admin/ProdutoForm'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Novo Produto — Forza Admin' }

export default function NovoProdutoPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        titulo="Novo produto"
        descricao="Cadastre um item que ainda não existe no catálogo — depois é possível sincronizar com o Tiny."
      />
      <ProdutoForm />
    </div>
  )
}
