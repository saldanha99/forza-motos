'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { CheckCircle2, Loader2, Undo2 } from 'lucide-react'
import { Botao } from '@/components/admin/ui/primitives'

/**
 * Alterna o campo `resolvido` de um registro de 404.
 * Estado otimista: o botão já reflete o novo valor antes da resposta da API
 * e volta ao valor anterior se a requisição falhar.
 */
export function AlternarResolvido404({
  id,
  resolvido,
}: {
  id: string
  resolvido: boolean
}) {
  const [otimista, setOtimista] = useState(resolvido)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function alternar() {
    const novoValor = !otimista
    setOtimista(novoValor)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/seo/404/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolvido: novoValor }),
        })
        if (!res.ok) throw new Error()
        toast.success(novoValor ? 'Marcado como resolvido' : 'Reaberto como pendente')
        router.refresh()
      } catch {
        setOtimista(!novoValor) // reverte o otimismo — a chamada falhou
        toast.error('Não foi possível atualizar. Tente novamente.')
      }
    })
  }

  return (
    <Botao
      variante={otimista ? 'secundario' : 'primario'}
      tamanho="sm"
      onClick={alternar}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 size={12} className="animate-spin" />
      ) : otimista ? (
        <Undo2 size={12} />
      ) : (
        <CheckCircle2 size={12} />
      )}
      {otimista ? 'Reabrir' : 'Marcar resolvido'}
    </Botao>
  )
}
