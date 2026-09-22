/**
 * Reconciliação periódica do ciclo logístico do Melhor Envio.
 *
 * É uma segunda camada além do webhook: se uma notificação for perdida ou a
 * etiqueta tiver sido emitida com outra credencial da mesma conta, a consulta
 * autenticada converge POSTADO → ENVIADO e ENTREGUE → ENTREGUE sem clique.
 */

import { prisma } from '@/lib/prisma'
import type { OrderStatus } from '@prisma/client'
import { agendarNotificacoesEtapaPedido } from '@/lib/checkout/notificacoes-etapas-pedido'
import { consultarEnvioME } from './melhor-envio'
import {
  analisarEstadoEnvioRemoto,
  statusPedidoDoEnvioRemoto,
  type EnvioStatus,
  type PedidoStatusLogistico,
} from './estado-envio'

const STATUS_ANTERIORES: Record<PedidoStatusLogistico, readonly OrderStatus[]> = {
  ENVIADO: ['CONFIRMADO', 'SEPARANDO'],
  ENTREGUE: ['CONFIRMADO', 'SEPARANDO', 'ENVIADO'],
}

type DadosEnvioRemoto = Record<string, unknown>

function comoRegistro(valor: unknown): DadosEnvioRemoto | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as DadosEnvioRemoto
    : null
}

function dadosDoEnvio(resposta: unknown): DadosEnvioRemoto {
  const raiz = comoRegistro(resposta)
  return comoRegistro(raiz?.data) ?? raiz ?? {}
}

function rastreioDoEnvio(resposta: unknown): string | null {
  const dados = dadosDoEnvio(resposta)
  const valor = dados.tracking ?? dados.self_tracking ?? dados.melhorenvio_tracking
  return valor ? String(valor).trim().slice(0, 120) : null
}

function estadoMelhorEnvioDaResposta(resposta: unknown): EnvioStatus | null {
  const remoto = analisarEstadoEnvioRemoto(resposta)
  if (remoto.cancelada) return 'CANCELADA'
  if (remoto.gerada) return 'GERADA'
  if (remoto.comprada) return 'COMPRADA'
  return null
}

async function aplicarEstadoRemoto(input: {
  orderId: string
  orderNumber: string
  melhorEnvioId: string
  resposta: unknown
}): Promise<{ atualizado: boolean; status: PedidoStatusLogistico | null }> {
  const dados = dadosDoEnvio(input.resposta)
  const statusRemoto = String(dados.status ?? '').trim().toLowerCase() || 'desconhecido'
  const statusMelhorEnvio = estadoMelhorEnvioDaResposta(input.resposta)
  // Cancelamento prevalece sobre datas/status logísticos incoerentes na origem.
  const statusPedido = statusMelhorEnvio === 'CANCELADA'
    ? null
    : statusPedidoDoEnvioRemoto(input.resposta)
  const rastreio = rastreioDoEnvio(input.resposta)

  const resultado = await prisma.$transaction(async (tx) => {
    const atual = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        status: true,
        melhorEnvioId: true,
        melhorEnvioStatus: true,
        trackingCode: true,
      },
    })
    if (!atual || atual.melhorEnvioId !== input.melhorEnvioId) {
      return { atualizouStatus: false, alterouAlgo: false }
    }

    let atualizouStatus = false
    let atualizouSeparacao = false
    let atualizouStatusMe = false
    let atualizouRastreio = false

    if (statusPedido) {
      const atualizacao = await tx.order.updateMany({
        where: {
          id: input.orderId,
          melhorEnvioId: input.melhorEnvioId,
          melhorEnvioStatus: { in: ['COMPRADA', 'GERADA'] },
          status: { in: [...STATUS_ANTERIORES[statusPedido]] },
        },
        data: { status: statusPedido },
      })
      atualizouStatus = atualizacao.count === 1
    }

    if (rastreio) {
      const atualizacao = await tx.order.updateMany({
        where: {
          id: input.orderId,
          melhorEnvioId: input.melhorEnvioId,
          trackingCode: null,
        },
        data: { trackingCode: rastreio },
      })
      atualizouRastreio = atualizacao.count === 1
    }

    if (statusMelhorEnvio === 'CANCELADA') {
      const atualizacao = await tx.order.updateMany({
        where: {
          id: input.orderId,
          melhorEnvioId: input.melhorEnvioId,
          melhorEnvioStatus: { not: 'CANCELADA' },
        },
        data: { melhorEnvioStatus: 'CANCELADA' },
      })
      atualizouStatusMe = atualizacao.count === 1
    } else if (statusMelhorEnvio === 'GERADA') {
      const atualizacao = await tx.order.updateMany({
        where: {
          id: input.orderId,
          melhorEnvioId: input.melhorEnvioId,
          OR: [
            { melhorEnvioStatus: null },
            { melhorEnvioStatus: { in: ['CARRINHO', 'COMPRA_INCERTA', 'COMPRADA'] } },
          ],
        },
        data: { melhorEnvioStatus: 'GERADA' },
      })
      atualizouStatusMe = atualizacao.count === 1
    } else if (statusMelhorEnvio === 'COMPRADA') {
      const atualizacao = await tx.order.updateMany({
        where: {
          id: input.orderId,
          melhorEnvioId: input.melhorEnvioId,
          OR: [
            { melhorEnvioStatus: null },
            { melhorEnvioStatus: { in: ['CARRINHO', 'COMPRA_INCERTA'] } },
          ],
        },
        data: { melhorEnvioStatus: 'COMPRADA' },
      })
      atualizouStatusMe = atualizacao.count === 1
    }

    // Também recupera uma geração feita fora do fluxo local.
    if (statusMelhorEnvio === 'GERADA' && !statusPedido) {
      const atualizacao = await tx.order.updateMany({
        where: {
          id: input.orderId,
          melhorEnvioId: input.melhorEnvioId,
          melhorEnvioStatus: 'GERADA',
          status: 'CONFIRMADO',
        },
        data: { status: 'SEPARANDO' },
      })
      atualizouSeparacao = atualizacao.count === 1
    }

    const alterouAlgo =
      atualizouStatus || atualizouSeparacao || atualizouStatusMe || atualizouRastreio
    if (alterouAlgo) {
      const descricao = statusPedido === 'ENTREGUE'
        ? 'Entrega confirmada automaticamente pelo rastreamento do Melhor Envio.'
        : statusPedido === 'ENVIADO'
          ? 'Postagem confirmada automaticamente pelo rastreamento do Melhor Envio.'
          : statusMelhorEnvio === 'CANCELADA'
            ? 'Cancelamento da etiqueta confirmado pela reconciliação do Melhor Envio.'
            : `Reconciliação do Melhor Envio: etiqueta em ${statusRemoto}.`

      await tx.orderTracking.create({
        data: {
          orderId: input.orderId,
          status: atualizouStatus && statusPedido
            ? statusPedido
            : atualizouSeparacao
              ? 'SEPARANDO'
              : atual.status,
          descricao: descricao + (atualizouRastreio && rastreio ? ` Rastreio: ${rastreio}.` : ''),
        },
      })
    }

    return { atualizouStatus, alterouAlgo }
  })

  if (resultado.alterouAlgo) {
    console.log(
      `[me-reconciliar] pedido ${input.orderNumber} convergiu; remoto=${statusRemoto}` +
        (statusPedido ? ` local=${statusPedido}` : ''),
    )
  }
  return { atualizado: resultado.alterouAlgo, status: resultado.atualizouStatus ? statusPedido : null }
}

export interface ResumoReconciliacaoEnvios {
  analisados: number
  atualizados: number
  enviados: number
  entregues: number
  falhas: number
}

export async function reconciliarStatusEnviosMelhorEnvio(
  limite = 30,
): Promise<ResumoReconciliacaoEnvios> {
  const pedidos = await prisma.order.findMany({
    where: {
      melhorEnvioId: { not: null },
      melhorEnvioStatus: { in: ['COMPRADA', 'GERADA'] },
      status: { in: ['CONFIRMADO', 'SEPARANDO', 'ENVIADO'] },
    },
    select: { id: true, orderNumber: true, melhorEnvioId: true },
    orderBy: { updatedAt: 'asc' },
    take: Math.max(1, Math.min(limite, 30)),
  })

  const resumo: ResumoReconciliacaoEnvios = {
    analisados: pedidos.length,
    atualizados: 0,
    enviados: 0,
    entregues: 0,
    falhas: 0,
  }

  // Pouca concorrência evita pressão desnecessária na API e ainda cabe no cron.
  for (let inicio = 0; inicio < pedidos.length; inicio += 6) {
    const lote = pedidos.slice(inicio, inicio + 6)
    await Promise.all(lote.map(async (pedido) => {
      try {
        const resposta = await consultarEnvioME(String(pedido.melhorEnvioId))
        if (!resposta) return
        const resultado = await aplicarEstadoRemoto({
          orderId: pedido.id,
          orderNumber: pedido.orderNumber,
          melhorEnvioId: String(pedido.melhorEnvioId),
          resposta,
        })
        if (resultado.status === 'ENVIADO' || resultado.status === 'ENTREGUE') {
          await agendarNotificacoesEtapaPedido(
            pedido.id,
            resultado.status === 'ENTREGUE' ? 'PEDIDO_ENTREGUE' : 'PEDIDO_ENVIADO',
          ).catch((error) => {
            console.error(
              `[me-reconciliar] notificação ${resultado.status} pendente para ${pedido.orderNumber}:`,
              error instanceof Error ? error.message : 'falha desconhecida',
            )
          })
        }
        if (resultado.atualizado) resumo.atualizados += 1
        if (resultado.status === 'ENVIADO') resumo.enviados += 1
        if (resultado.status === 'ENTREGUE') resumo.entregues += 1
      } catch (error) {
        resumo.falhas += 1
        console.error(
          `[me-reconciliar] pedido ${pedido.orderNumber}:`,
          error instanceof Error ? error.message : 'falha desconhecida',
        )
      }
    }))
  }

  return resumo
}
