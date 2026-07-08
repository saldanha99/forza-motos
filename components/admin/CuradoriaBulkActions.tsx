'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface CuradoriaBulkActionsProps {
  cat: string
  q: string
  estado: string
  total: number
}

export function CuradoriaBulkActions({ cat, q, estado, total }: CuradoriaBulkActionsProps) {
  const router = useRouter()
  const [carregando, setCarregando] = useState<string | null>(null) // 'ativar' | 'desativar' | null

  async function executar(acao: 'ativar' | 'desativar') {
    const textoAcao = acao === 'desativar' ? 'ocultar da loja' : 'exibir na loja'
    const confirmou = window.confirm(
      `Tem certeza que deseja ${textoAcao} todos os ${total} produtos correspondentes a este filtro?`
    )
    if (!confirmou) return

    setCarregando(acao)
    try {
      const res = await fetch('/api/admin/curadoria/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat, q, estado, acao }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao executar ação em lote')
      }

      toast.success(
        acao === 'desativar'
          ? 'Todos os produtos filtrados foram ocultados!'
          : 'Produtos filtrados atualizados com sucesso!'
      )
      
      router.refresh()
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Erro ao executar ação em lote.')
    } finally {
      setCarregando(null)
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={() => executar('desativar')}
        disabled={carregando !== null}
        className="flex items-center gap-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 disabled:opacity-50 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
        title="Ocultar todos os produtos que atendem ao filtro atual"
      >
        {carregando === 'desativar' ? (
          <LoaderCircle size={13} className="animate-spin text-rose-400" />
        ) : (
          <EyeOff size={13} className="text-rose-400" />
        )}
        Ocultar todos do filtro
      </button>

      <button
        onClick={() => executar('ativar')}
        disabled={carregando !== null}
        className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 disabled:opacity-50 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
        title="Ativar/Exibir todos os produtos que atendem ao filtro atual e possuem imagem/estoque"
      >
        {carregando === 'ativar' ? (
          <LoaderCircle size={13} className="animate-spin text-emerald-400" />
        ) : (
          <Eye size={13} className="text-emerald-400" />
        )}
        Exibir todos do filtro
      </button>
    </div>
  )
}
