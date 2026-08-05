'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Botao } from '@/components/admin/ui/primitives'

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
    <div className="flex items-center gap-2">
      <Botao
        type="button"
        variante="perigo"
        tamanho="sm"
        onClick={() => executar('desativar')}
        disabled={carregando !== null}
        title="Ocultar todos os produtos que atendem ao filtro atual"
      >
        {carregando === 'desativar' ? (
          <LoaderCircle size={13} className="animate-spin" />
        ) : (
          <EyeOff size={13} />
        )}
        Ocultar todos do filtro
      </Botao>

      <Botao
        type="button"
        tamanho="sm"
        onClick={() => executar('ativar')}
        disabled={carregando !== null}
        title="Ativar/Exibir todos os produtos que atendem ao filtro atual e possuem imagem/estoque"
        className="bg-brand-success text-brand-on-accent hover:brightness-95"
      >
        {carregando === 'ativar' ? (
          <LoaderCircle size={13} className="animate-spin" />
        ) : (
          <Eye size={13} />
        )}
        Exibir todos do filtro
      </Botao>
    </div>
  )
}
