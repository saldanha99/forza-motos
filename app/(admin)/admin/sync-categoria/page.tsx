export const dynamic = 'force-dynamic'
import { SyncCategoriaClient } from '@/components/admin/SyncCategoriaClient'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Sync por Categoria' }

export default function SyncCategoriaPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        titulo="Sync por Categoria"
        descricao="Sincroniza todos os campos (imagens, preço, estoque, descrição) de uma categoria inteira com o Tiny."
      />
      <SyncCategoriaClient />
    </div>
  )
}
