'use client'

/**
 * Envio pelo Melhor Envio no detalhe do pedido.
 *
 * A NF-e autorizada na Olist prepara automaticamente o carrinho (sem gastar).
 * A compra da etiqueta debita saldo real e continua sendo um clique consciente.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, LoaderCircle, Printer, ExternalLink } from 'lucide-react'
import { Botao, Card, CardHeader } from '@/components/admin/ui/primitives'
import { ehServicoMelhorEnvio } from '@/lib/frete/servico'

interface Props {
  pedidoId: string
  freteServico: string | null
  freteTransportadora: string | null
  statusPedido: string
  nfeChave: string | null
  melhorEnvioId: string | null
  melhorEnvioStatus: string | null
  trackingCode: string | null
}

export function EtiquetaMelhorEnvio({
  pedidoId,
  freteServico,
  freteTransportadora,
  statusPedido,
  nfeChave,
  melhorEnvioId,
  melhorEnvioStatus,
  trackingCode,
}: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<'idle' | 'preparando' | 'comprando' | 'gerando'>('idle')
  const [erro, setErro] = useState('')
  const [chaveNfe, setChaveNfe] = useState(nfeChave ?? '')

  useEffect(() => {
    setChaveNfe(nfeChave ?? '')
  }, [nfeChave])

  // Retirada no balcão não tem envio
  if (freteServico === 'retirada') return null

  if (!ehServicoMelhorEnvio(freteServico)) {
    return (
      <Card>
        <CardHeader titulo="Envio manual" />
        <div className="space-y-2 p-5 text-sm">
          <p className="text-brand-text font-medium">{freteTransportadora ?? 'Transportadora não informada'}</p>
          <p className="text-brand-muted text-xs leading-relaxed">
            Esta foi uma cotação alternativa. Emita e gerencie a etiqueta manualmente; este pedido não será enviado à conta do Melhor Envio.
          </p>
        </div>
      </Card>
    )
  }

  async function chamar(
    metodo: 'PUT' | 'POST' | 'PATCH',
    opcoes: { confirmarNovaTentativa?: boolean } = {},
  ) {
    setErro('')
    setEstado(
      metodo === 'PUT'
        ? 'preparando'
        : metodo === 'PATCH' || melhorEnvioStatus === 'COMPRADA' || melhorEnvioStatus === 'GERADA'
          ? 'gerando'
          : 'comprando',
    )
    try {
      const res = await fetch(`/api/admin/pedidos/${pedidoId}/etiqueta`, {
        method: metodo,
        ...((metodo === 'PUT' || (metodo === 'POST' && opcoes.confirmarNovaTentativa)) && {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            metodo === 'PUT'
              ? { nfeChave: chaveNfe.replace(/\D/g, '') }
              : { confirmarNovaTentativa: true },
          ),
        }),
      })
      const data = await res.json()
      if ((!res.ok && res.status !== 202) || data.error) {
        setErro(data.error ?? `Erro HTTP ${res.status}`)
        if (metodo === 'POST' || metodo === 'PATCH') router.refresh()
        return
      }
      if (res.status === 202 || data.status === 'COMPRA_INCERTA') {
        setErro('A compra ainda não foi confirmada pelo Melhor Envio. Nenhuma nova cobrança foi feita.')
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

  function repetirCompraIncerta() {
    const ok = window.confirm(
      'Tentar comprar a etiqueta novamente?\n\n' +
        'O sistema consultará o Melhor Envio antes. Se a compra anterior já estiver confirmada, ' +
        'não haverá novo débito. Caso ela realmente não tenha ocorrido, o saldo será debitado agora.',
    )
    if (ok) chamar('POST', { confirmarNovaTentativa: true })
  }

  const comprada = melhorEnvioStatus === 'COMPRADA'
  const gerada = melhorEnvioStatus === 'GERADA'
  const compraIncerta = melhorEnvioStatus === 'COMPRA_INCERTA'
  const cancelada = melhorEnvioStatus === 'CANCELADA'
  const podeIniciarEnvio = ['CONFIRMADO', 'SEPARANDO'].includes(statusPedido)
  const chaveLimpa = chaveNfe.replace(/\D/g, '')

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
              {melhorEnvioStatus === 'COMPRA_INCERTA' && 'Compra não confirmada — verificar antes de tentar novamente'}
              {melhorEnvioStatus === 'COMPRADA' && 'Etiqueta comprada'}
              {melhorEnvioStatus === 'GERADA' && 'Etiqueta pronta para imprimir'}
              {melhorEnvioStatus === 'CANCELADA' && 'Etiqueta cancelada no Melhor Envio'}
            </dd>
          </div>
          {trackingCode && (
            <div>
              <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">Rastreio</dt>
              <dd className="text-brand-text font-mono text-xs font-medium mt-0.5">{trackingCode}</dd>
            </div>
          )}
          {nfeChave && (
            <div>
              <dt className="text-brand-dim text-xs font-semibold uppercase tracking-wider">NF-e</dt>
              <dd className="text-brand-text font-mono text-[10px] break-all mt-0.5">{nfeChave}</dd>
            </div>
          )}
        </dl>

        {!melhorEnvioId && (
          <div className="space-y-2 rounded-lg border border-brand-hair p-3">
            <p className="text-brand-muted text-[10px] leading-relaxed">
              Automático: quando a Olist autorizar a NF-e, o site salva a chave e prepara esta remessa. A verificação também se repete a cada 5 minutos e não debita saldo.
            </p>
            <label htmlFor={`nfe-${pedidoId}`} className="block text-brand-dim text-[11px] font-semibold uppercase tracking-wider">
              Fallback manual — chave da NF-e (44 dígitos)
            </label>
            <input
              id={`nfe-${pedidoId}`}
              value={chaveNfe}
              onChange={(event) => setChaveNfe(event.target.value.replace(/\D/g, '').slice(0, 44))}
              inputMode="numeric"
              autoComplete="off"
              disabled={Boolean(nfeChave) || estado !== 'idle' || !podeIniciarEnvio}
              placeholder="Cole a chave emitida pelo Olist"
              className="w-full rounded-lg border border-brand-hair bg-brand-surface px-3 py-2 font-mono text-xs text-brand-text outline-none focus:border-brand-accent disabled:opacity-60"
            />
            <p className="text-brand-dim text-[10px] leading-relaxed">
              Use este campo apenas se a sincronização automática continuar pendente. Preparar não debita saldo; comprar continua no passo seguinte.
            </p>
            {!podeIniciarEnvio && (
              <p className="text-brand-warning text-[10px]">
                O status atual do pedido não permite preparar uma nova etiqueta.
              </p>
            )}
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => chamar('PUT')}
              disabled={estado !== 'idle' || !podeIniciarEnvio || chaveLimpa.length !== 44}
              className="w-full uppercase tracking-wider"
            >
              {estado === 'preparando' ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Package size={14} />
              )}
              {estado === 'preparando' ? 'Preparando…' : 'Salvar NF-e e preparar'}
            </Botao>
          </div>
        )}

        {melhorEnvioId && !comprada && !gerada && !compraIncerta && !cancelada && podeIniciarEnvio && (
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

        {melhorEnvioId && compraIncerta && (
          <div className="space-y-2">
            <p className="text-brand-warning text-[10px] leading-relaxed">
              O resultado financeiro ficou incerto. Primeiro verifique a compra; essa consulta não debita saldo.
            </p>
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => chamar('POST')}
              disabled={estado !== 'idle'}
              className="w-full uppercase tracking-wider"
            >
              {estado === 'comprando' ? <LoaderCircle size={14} className="animate-spin" /> : <Package size={14} />}
              {estado === 'comprando' ? 'Verificando…' : 'Verificar compra'}
            </Botao>
            <Botao
              variante="perigo"
              tamanho="sm"
              onClick={repetirCompraIncerta}
              disabled={estado !== 'idle' || !podeIniciarEnvio}
              className="w-full uppercase tracking-wider"
            >
              Tentar compra novamente
            </Botao>
          </div>
        )}

        {melhorEnvioId && comprada && (
          <div className="space-y-2">
            <p className="text-brand-muted text-[10px] leading-relaxed">
              O pagamento da etiqueta já foi confirmado. Se o PDF ainda estiver sendo processado, esta ação apenas recupera a impressão e não debita novamente.
            </p>
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => chamar('PATCH')}
              disabled={estado !== 'idle'}
              className="w-full uppercase tracking-wider"
            >
              {estado === 'gerando' ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Printer size={14} />
              )}
              {estado === 'gerando' ? 'Gerando…' : 'Gerar/recuperar etiqueta'}
            </Botao>
          </div>
        )}

        {melhorEnvioId && gerada && (
          <a
            href={`/api/admin/pedidos/${pedidoId}/etiqueta/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-text flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
          >
            <ExternalLink size={13} />
            Abrir etiqueta (PDF)
          </a>
        )}

        {melhorEnvioId && cancelada && (
          <p className="text-brand-muted text-[10px] leading-relaxed">
            O envio foi cancelado. Depois da confirmação do estorno pelo Melhor Envio, o pedido pode seguir para cancelamento no painel.
          </p>
        )}

        {erro && <p className="text-brand-danger text-[11px]">{erro}</p>}
      </div>
    </Card>
  )
}
