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
import { enviarEmailRastreio } from '@/lib/email/send'

export const dynamic = 'force-dynamic'

/** Eventos do ME que significam "saiu para entrega" / "chegou" */
const STATUS_POR_EVENTO: Record<string, 'ENVIADO' | 'ENTREGUE'> = {
  'order.posted': 'ENVIADO',
  'order.delivered': 'ENTREGUE',
  posted: 'ENVIADO',
  delivered: 'ENTREGUE',
}

/** Requisição de teste do cadastro — precisa de 200 ou o ME recusa a URL */
export async function GET() {
  return NextResponse.json({ ok: true, servico: 'webhook Melhor Envio' })
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}

export async function POST(req: Request) {
  try {
    // Proteção opcional: só exige o secret se ele estiver configurado. Sem ele
    // o estrago possível é pequeno — só afeta pedido cujo id de envio (UUID
    // gerado pelo ME) o atacante já conheça.
    const segredo = process.env.MELHOR_ENVIO_WEBHOOK_SECRET
    if (segredo) {
      const url = new URL(req.url)
      if (url.searchParams.get('secret') !== segredo) {
        return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
      }
    }

    const texto = await req.text()
    if (!texto.trim()) {
      // Teste de cadastro costuma vir sem corpo
      return NextResponse.json({ ok: true, teste: true })
    }

    let body: any
    try {
      body = JSON.parse(texto)
    } catch {
      body = Object.fromEntries(new URLSearchParams(texto))
    }

    const evento = body.event || body.evento || ''
    // Loga tudo: o formato real do ME só se descobre vendo o que chega
    console.log(
      `[me-webhook] evento="${evento}" chaves=${Object.keys(body).join(',')} payload=${texto.slice(0, 500)}`,
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
        freteTransportadora: true,
        fretePrazo: true,
        enderecoEntrega: true,
        user: { select: { nome: true, email: true } },
      },
    })
    if (!pedido) {
      console.warn(`[me-webhook] envio ${envioId} não corresponde a nenhum pedido`)
      return NextResponse.json({ ok: true, ignorado: 'pedido não encontrado' })
    }

    const rastreio =
      dados?.tracking ?? dados?.melhorenvio_tracking ?? dados?.protocol ?? null
    const novoStatus = STATUS_POR_EVENTO[evento] ?? STATUS_POR_EVENTO[String(dados?.status ?? '')]

    // Só avança o status. Cancelar etiqueta não é cancelar pedido, e um evento
    // atrasado não pode empurrar o pedido para trás.
    const avanca =
      novoStatus &&
      pedido.status !== novoStatus &&
      !(novoStatus === 'ENVIADO' && pedido.status === 'ENTREGUE')

    if (!avanca && (!rastreio || pedido.trackingCode)) {
      return NextResponse.json({ ok: true, semMudanca: true })
    }

    await prisma.order.update({
      where: { id: pedido.id },
      data: {
        ...(avanca && { status: novoStatus as any }),
        ...(rastreio && !pedido.trackingCode && { trackingCode: String(rastreio) }),
      },
    })

    await prisma.orderTracking.create({
      data: {
        orderId: pedido.id,
        status: (avanca ? novoStatus : pedido.status) as any,
        descricao:
          `Melhor Envio: ${evento || 'atualização de etiqueta'}.` +
          (rastreio ? ` Rastreio: ${rastreio}.` : ''),
      },
    })

    // Avisa o cliente na primeira vez que o rastreio aparece
    if (rastreio && !pedido.trackingCode) {
      const email = pedido.user?.email ?? (pedido.enderecoEntrega as any)?.email
      const nome = pedido.user?.nome ?? (pedido.enderecoEntrega as any)?.nome ?? 'Cliente'
      if (email) {
        await enviarEmailRastreio({
          para: email,
          nomeCliente: nome,
          numeroPedido: pedido.orderNumber,
          rastreio: String(rastreio),
          transportadora: pedido.freteTransportadora ?? 'Transportadora',
          prazo: pedido.fretePrazo,
        }).catch((e) => console.error('[me-webhook] falha no e-mail de rastreio:', e))
      }
    }

    console.log(`[me-webhook] pedido ${pedido.orderNumber} atualizado (${evento})`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[me-webhook] erro:', e)
    // 200 sempre: o ME desativa webhook que responde erro demais
    return NextResponse.json({ ok: true })
  }
}
