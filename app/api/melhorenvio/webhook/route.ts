/**
 * Webhook do Melhor Envio — "atualização das etiquetas criadas e editadas".
 *
 * Registrar em: Melhor Envio → Integrações → seu aplicativo → Novo Webhook
 *   URL: https://www.forzamotos.com.br/api/melhorenvio/webhook
 *
 * O ME dispara uma requisição de TESTE ao salvar o cadastro e recusa a URL se
 * ela não responder 2xx (erro E-WBH-0002). Por isso GET, HEAD e POST sem corpo
 * respondem 200.
 *
 * O que ele traz de útil: o rastreio assim que a etiqueta é postada — é o que
 * dispensa ficar consultando a API e faz o e-mail de rastreio sair sozinho.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { agendarNotificacoesEtapaPedido } from '@/lib/checkout/notificacoes-etapas-pedido'
import { assinaturaWebhookMelhorEnvioValida } from '@/lib/frete/webhook-me-seguranca'
import { statusPedidoDoEnvioRemoto } from '@/lib/frete/estado-envio'

export const dynamic = 'force-dynamic'

/** Confirmações logísticas monotônicas — eventos atrasados nunca regridem. */
const STATUS_ME_POR_EVENTO: Record<string, 'COMPRADA' | 'GERADA' | 'CANCELADA'> = {
  'order.released': 'COMPRADA',
  released: 'COMPRADA',
  'order.generated': 'GERADA',
  generated: 'GERADA',
  'order.received': 'GERADA',
  received: 'GERADA',
  'order.posted': 'GERADA',
  posted: 'GERADA',
  'order.delivered': 'GERADA',
  delivered: 'GERADA',
  'order.undelivered': 'GERADA',
  undelivered: 'GERADA',
  'order.paused': 'GERADA',
  paused: 'GERADA',
  'order.suspended': 'GERADA',
  suspended: 'GERADA',
  'order.cancelled': 'CANCELADA',
  cancelled: 'CANCELADA',
  canceled: 'CANCELADA',
}

/** Requisição de teste do cadastro — precisa de 200 ou o ME recusa a URL */
export async function GET() {
  return NextResponse.json({ ok: true, servico: 'webhook Melhor Envio' })
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}

export async function POST(req: Request) {
  // O Melhor Envio assina o corpo bruto com HMAC-SHA256 e envia o resultado
  // base64 em X-ME-Signature. O segredo é o secret do próprio aplicativo.
  const segredo = process.env.MELHOR_ENVIO_CLIENT_SECRET
  if (!segredo) {
    console.error('[me-webhook] secret do aplicativo não configurado — rejeitando')
    return NextResponse.json({ error: 'webhook não configurado' }, { status: 503 })
  }

  const tamanho = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(tamanho) && tamanho > 1_000_000) {
    return NextResponse.json({ error: 'payload muito grande' }, { status: 413 })
  }

  const texto = await req.text()
  const assinatura = req.headers.get('x-me-signature') ?? ''
  if (!assinaturaWebhookMelhorEnvioValida(texto, assinatura, segredo)) {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 })
  }

  try {
    if (!texto.trim()) {
      // Um teste vazio ainda precisa ter a assinatura HMAC correta.
      return NextResponse.json({ ok: true, teste: true })
    }

    let body: any
    try {
      body = JSON.parse(texto)
    } catch {
      body = Object.fromEntries(new URLSearchParams(texto))
    }

    const evento = body.event || body.evento || ''
    console.log(
      `[me-webhook] evento="${evento}" chaves=${Object.keys(body).join(',')}`,
    )

    const dados = body.data ?? body.dados ?? body
    const envioId = String(dados?.id ?? body.id ?? '')
    if (!envioId) {
      console.warn('[me-webhook] payload sem id de envio — ignorado')
      return NextResponse.json({ ok: true, ignorado: 'sem id' })
    }

    const pedido = await prisma.order.findFirst({
      where: { melhorEnvioId: envioId },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        trackingCode: true,
        melhorEnvioStatus: true,
        freteTransportadora: true,
        fretePrazo: true,
        enderecoEntrega: true,
        user: { select: { nome: true, email: true } },
      },
    })
    if (!pedido) {
      console.warn(`[me-webhook] envio ${envioId} não corresponde a nenhum pedido`)
      // Pode ser a janela entre o POST /me/cart e a persistência do id local.
      // Pedimos retry para que a notificação convirja depois do commit.
      return NextResponse.json({ error: 'pedido ainda não disponível' }, { status: 503 })
    }

    // `protocol` NÃO entra aqui: é o número do pedido no ME ("ORD-2026…"),
    // não rastreio. Usá-lo mandaria um código inválido no e-mail do cliente.
    const rastreioBruto = dados?.tracking ?? dados?.self_tracking ?? dados?.melhorenvio_tracking ?? null
    const rastreio = rastreioBruto ? String(rastreioBruto).trim().slice(0, 120) : null
    const novoStatusMe = STATUS_ME_POR_EVENTO[evento] ?? STATUS_ME_POR_EVENTO[String(dados?.status ?? '')]
    // Cancelamento de etiqueta não pode confirmar uma postagem por campos
    // residuais/incoerentes do mesmo payload.
    const novoStatus = novoStatusMe === 'CANCELADA'
      ? null
      : statusPedidoDoEnvioRemoto(dados, evento)

    const statusAnteriores = novoStatus === 'ENVIADO'
      ? ['CONFIRMADO', 'SEPARANDO']
      : novoStatus === 'ENTREGUE'
        ? ['CONFIRMADO', 'SEPARANDO', 'ENVIADO']
        : []

    const resultado = await prisma.$transaction(async (tx) => {
      let atualizouStatus = false
      let atualizouRastreio = false
      let atualizouStatusMe = false
      let atualizouSeparacao = false

      if (novoStatus && statusAnteriores.length > 0) {
        const atualizacao = await tx.order.updateMany({
          where: { id: pedido.id, status: { in: statusAnteriores as any } },
          data: { status: novoStatus },
        })
        atualizouStatus = atualizacao.count === 1
      }

      if (rastreio) {
        const atualizacao = await tx.order.updateMany({
          where: { id: pedido.id, trackingCode: null },
          data: { trackingCode: rastreio },
        })
        atualizouRastreio = atualizacao.count === 1
      }

      if (novoStatusMe === 'COMPRADA') {
        const atualizacao = await tx.order.updateMany({
          where: {
            id: pedido.id,
            OR: [
              { melhorEnvioStatus: null },
              { melhorEnvioStatus: { in: ['CARRINHO', 'COMPRA_INCERTA'] } },
            ],
          },
          data: { melhorEnvioStatus: 'COMPRADA' },
        })
        atualizouStatusMe = atualizacao.count === 1
      } else if (novoStatusMe === 'GERADA') {
        const atualizacao = await tx.order.updateMany({
          where: {
            id: pedido.id,
            OR: [
              { melhorEnvioStatus: null },
              { melhorEnvioStatus: { in: ['CARRINHO', 'COMPRA_INCERTA', 'COMPRADA'] } },
            ],
          },
          data: { melhorEnvioStatus: 'GERADA' },
        })
        atualizouStatusMe = atualizacao.count === 1

        if (!novoStatus) {
          const separacao = await tx.order.updateMany({
            where: { id: pedido.id, status: 'CONFIRMADO' },
            data: { status: 'SEPARANDO' },
          })
          atualizouSeparacao = separacao.count === 1
        }
      } else if (novoStatusMe === 'CANCELADA') {
        const atualizacao = await tx.order.updateMany({
          where: {
            id: pedido.id,
            OR: [
              { melhorEnvioStatus: null },
              { melhorEnvioStatus: { not: 'CANCELADA' } },
            ],
          },
          data: { melhorEnvioStatus: 'CANCELADA' },
        })
        atualizouStatusMe = atualizacao.count === 1
      }

      if (atualizouStatus || atualizouRastreio || atualizouStatusMe || atualizouSeparacao) {
        await tx.orderTracking.create({
          data: {
            orderId: pedido.id,
            status: atualizouStatus && novoStatus
              ? novoStatus
              : atualizouSeparacao
                ? 'SEPARANDO'
                : pedido.status,
            descricao:
              `Melhor Envio: ${evento || 'atualização de etiqueta'}.` +
              (atualizouRastreio && rastreio ? ` Rastreio: ${rastreio}.` : ''),
          },
        })
      }

      return { atualizouStatus, atualizouRastreio, atualizouStatusMe, atualizouSeparacao }
    })

    // O evento de negócio (postagem/entrega), e não a primeira gravação do
    // rastreio, é o gatilho. A etiqueta já costuma trazer o código antes de ser
    // postada; depender de `atualizouRastreio` fazia o aviso nunca sair.
    if (novoStatus === 'ENVIADO' || novoStatus === 'ENTREGUE') {
      await agendarNotificacoesEtapaPedido(
        pedido.id,
        novoStatus === 'ENTREGUE' ? 'PEDIDO_ENTREGUE' : 'PEDIDO_ENVIADO',
      ).catch((error) => {
        console.error(
          `[me-webhook] notificação ${novoStatus} pendente para ${pedido.orderNumber}:`,
          error instanceof Error ? error.message : 'falha desconhecida',
        )
      })
    }

    if (
      !resultado.atualizouStatus &&
      !resultado.atualizouRastreio &&
      !resultado.atualizouStatusMe &&
      !resultado.atualizouSeparacao
    ) {
      return NextResponse.json({ ok: true, semMudanca: true })
    }

    console.log(`[me-webhook] pedido ${pedido.orderNumber} atualizado (${evento})`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[me-webhook] erro:', e)
    // Falha real precisa de resposta não-2xx para que o provedor tente de novo.
    return NextResponse.json({ error: 'falha ao processar webhook' }, { status: 500 })
  }
}
