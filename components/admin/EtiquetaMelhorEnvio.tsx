'use client'

/**
 * Envio pelo Melhor Envio no detalhe do pedido — fluxo semi-automático.
 *
 * O pagamento aprovado já deixa o envio pronto no carrinho do ME (sem gastar).
 * A compra da etiqueta debita saldo real, então é sempre um clique consciente,
 * com confirmação.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, LoaderCircle, Printer, ExternalLink } from 'lucide-react'
import { Botao, Card, CardHeader } from '@/components/admin/ui/primitives'

interface Props {
  pedidoId: string
  freteServico: string | null
  freteTransportadora: string | null
  melhorEnvioId: string | null
  melhorEnvioStatus: string | null
  melhorEnvioEtiqueta: string | null
  trackingCode: string | null
}

export function EtiquetaMelhorEnvio({
  pedidoId,
  freteServico,
  freteTransportadora,
  melhorEnvioId,
  melhorEnvioStatus,
  melhorEnvioEtiqueta,
  trackingCode,
}: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<'idle' | 'preparando' | 'comprando'>('idle')
  const [erro, setErro] = useState('')

  // Retirada no balcão não tem envio
  if (freteServico === 'retirada') return null

  async function chamar(metodo: 'PUT' | 'POST') {
    setErro('')
    setEstado(metodo === 'PUT' ? 'preparando' : 'comprando')
    try {
      const res = await fetch(`/api/admin/pedidos/${pedidoId}/etiqueta`, { method: metodo })
      const data = await res.json()
      if (!res.ok || data.error) {
        setErro(data.error ?? `Erro HTTP ${res.status}`)
        return
      }
      if (data.motivo && !data.melhorEnvioId) setErro(data.motivo)
      router.refresh()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setEstado('idle')
    }
  }

  function comprar() {
    const ok = window.confirm(
      'Comprar a etiqueta agora?\n\n' +
        'Isso debita o saldo da conta do Melhor Envio. Confira o endereço e o ' +
        'peso antes de confirmar.',
    )
    if (ok) chamar('POST')
  }

  const comprada = melhorEnvioStatus === 'COMPRADA' || melhorEnvioStatus === 'GERADA'

  return (
    <Card>
      <CardHeader titulo="Envio — Melhor Envio" />
      <div className="space-y-3 p-5 text-sm">
        <dl className="space-y-2">
          <div>
            <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">Serviço</dt>
            <dd className="text-brand-text font-medium mt-0.5">{freteTransportadora ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">Situação</dt>
            <dd className="text-brand-text font-medium mt-0.5">
              {!melhorEnvioId && 'Não preparado'}
              {melhorEnvioStatus === 'CARRINHO' && 'No carrinho — etiqueta não comprada'}
              {melhorEnvioStatus === 'COMPRADA' && 'Etiqueta comprada'}
              {melhorEnvioStatus === 'GERADA' && 'Etiqueta pronta para imprimir'}
            </dd>
          </div>
          {trackingCode && (
            <div>
              <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">Rastreio</dt>
              <dd className="text-brand-text font-mono text-xs font-medium mt-0.5">{trackingCode}</dd>
            </div>
          )}
        </dl>

        {!melhorEnvioId && (
          <Botao
            variante="secundario"
            tamanho="sm"
            onClick={() => chamar('PUT')}
            disabled={estado !== 'idle'}
            className="w-full uppercase tracking-wider"
          >
            {estado === 'preparando' ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Package size={14} />
            )}
            {estado === 'preparando' ? 'Preparando…' : 'Preparar envio'}
          </Botao>
        )}

        {melhorEnvioId && !comprada && (
          <Botao
            variante="perigo"
            tamanho="sm"
            onClick={comprar}
            disabled={estado !== 'idle'}
            className="w-full uppercase tracking-wider"
          >
            {estado === 'comprando' ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Printer size={14} />
            )}
            {estado === 'comprando' ? 'Comprando…' : 'Comprar etiqueta'}
          </Botao>
        )}

        {melhorEnvioEtiqueta && (
          <a
            href={melhorEnvioEtiqueta}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-text flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
          >
            <ExternalLink size={13} />
            Abrir etiqueta (PDF)
          </a>
        )}

        {erro && <p className="text-brand-danger text-[11px]">{erro}</p>}
      </div>
    </Card>
  )
}
