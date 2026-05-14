export const dynamic = 'force-dynamic'
import { SyncCategoriaClient } from '@/components/admin/SyncCategoriaClient'

export const metadata = { title: 'Sync por Categoria' }

export default function SyncCategoriaPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="font-rajdhani font-bold text-3xl text-white">Sync por Categoria</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Sincroniza todos os campos (imagens, preço, estoque, descrição) de uma categoria inteira com o Tiny
        </p>
      </div>
      <SyncCategoriaClient />
    </div>
  )
}
