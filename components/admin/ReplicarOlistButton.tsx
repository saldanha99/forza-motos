'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload, LoaderCircle } from 'lucide-react'
import { Botao } from '@/components/admin/ui/primitives'

export function ReplicarOlistButton({
  pedidoId,
  incerto = false,
}: {
  pedidoId: string
  incerto?: boolean
}) {
  const router = useRouter()
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'erro'>('idle')
  const [erro, setErro] = useState('')

  async function replicar(confirmarNovaInclusao = false) {
    setEstado('enviando')
    setErro('')
    try {
      const res = await fetch(`/api/admin/pedidos/${pedidoId}/replicar-olist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmarNovaInclusao }),
      })
      const data = await res.json()
      if (res.status === 409 && data.requerConfirmacao) {
        setEstado('idle')
        const confirmou = window.confirm(
          `${data.error}\n\nSó continue depois de conferir no painel do Olist que a venda não existe. ` +
          'Uma nova inclusão pode duplicar o pedido e a baixa de estoque. Deseja reenviar mesmo assim?',
        )
        if (confirmou) await replicar(true)
        return
      }
      if (!res.ok || data.error) {
        setEstado('erro')
        setErro(data.error ?? `Erro HTTP ${res.status}`)
        return
      }
      router.refresh()
      setEstado('idle')
    } catch (e: any) {
      setEstado('erro')
      setErro(e.message)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Botao
        variante={incerto ? 'secundario' : 'perigo'}
        tamanho="sm"
        onClick={() => replicar(false)}
        disabled={estado === 'enviando'}
        className="uppercase tracking-wider"
      >
        {estado === 'enviando' ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : (
          <CloudUpload size={14} />
        )}
        {estado === 'enviando'
          ? incerto ? 'Verificando…' : 'Replicando…'
          : incerto ? 'Verificar no Olist' : 'Replicar no Olist'}
      </Botao>
      {estado === 'erro' ? (
        <p aria-live="polite" className="max-w-[240px] text-right text-[11px] text-brand-danger">
          {erro}
        </p>
      ) : null}
    </div>
  )
}
