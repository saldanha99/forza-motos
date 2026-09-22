/**
 * Webhook recebido do Tiny / OLIST
 *
 * Eventos tratados:
 * - produto.criado / produto.alterado → sincroniza o produto no banco
 * - order.updated → atualiza status do pedido
 *
 * Para registrar este webhook no Tiny:
 *   Menu → Configurações → API → Webhooks
 *   URL: https://forzamotos.com.br/api/olist/webhook
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncProdutoUnico, syncEstoqueProduto } from '@/lib/olist/sync-products'
import { agendarNotificacoesEtapaPedido } from '@/lib/checkout/notificacoes-etapas-pedido'
import {
  interpretarEventoLogisticaOlist,
  normalizarSituacaoOlist,
  statusInternoDaSituacaoOlist,
} from '@/lib/olist/nfe-envio-core'
import { processarNotaFiscalOlist } from '@/lib/olist/nfe-envio'

export const maxDuration = 60

const ORDEM_STATUS: Record<string, number> = {
  AGUARDANDO_PAGAMENTO: 0,
  CONFIRMADO: 1,
  SEPARANDO: 2,
  ENVIADO: 3,
  ENTREGUE: 4,
}

function payloadSeguroParaLog(body: unknown, limite: number): string {
  const sensivel = /cpf|cnpj|documento|email|telefone|fone|whatsapp|endereco|cep|token|secret|senha|nome|chave|danfe/i
  try {
    return JSON.stringify(body, (chave, valor) =>
      chave && sensivel.test(chave) ? '[redigido]' : valor,
    ).slice(0, limite)
  } catch {
    return '[payload não serializável]'
  }
}

export async function POST(req: Request) {
  try {
    // Proteção por token na URL (?secret=...). Fail-closed: sem
    // OLIST_WEBHOOK_SECRET configurado, o webhook rejeita tudo — um POST
    // forjado aqui altera estoque e status de pedidos.
    const segredo = process.env.OLIST_WEBHOOK_SECRET
    if (!segredo) {
      console.error('[olist-webhook] OLIST_WEBHOOK_SECRET não configurado — rejeitando')
      return NextResponse.json({ error: 'webhook não configurado' }, { status: 503 })
    }
    const url = new URL(req.url)
    if (url.searchParams.get('secret') !== segredo) {
      return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
    }

    // Tiny envia JSON ou form-encoded dependendo da configuração
    const contentType = req.headers.get('content-type') ?? ''
    let body: any

    if (contentType.includes('application/json')) {
      body = await req.json()
    } else {
      const text = await req.text()
      try {
        // Tiny às vezes envia JSON dentro de um campo "dados"
        const params = new URLSearchParams(text)
        const dados = params.get('dados')
        body = dados ? JSON.parse(dados) : Object.fromEntries(params)
      } catch {
        body = {}
      }
    }

    const evento = body.evento || body.event || ''
    const tipo = body.tipo || ''

    // Loga TODA chamada recebida, antes de qualquer roteamento. Sem isso um
    // evento com formato inesperado saía pelo `ok: true` do final sem deixar
    // rastro, e ficava impossível distinguir "Olist não chama" de "Olist chama
    // e a gente ignora" (investigação de 06/08/2026).
    // Payload junto de propósito: logar só as chaves escondeu que o campo do
    // produto em `dados` não é `id`, e os 180 eventos de estoque que chegaram
    // saíam sem sincronizar nada.
    console.log(
      `[webhook] recebido evento="${evento}" tipo="${tipo}" payload=${payloadSeguroParaLog(body, 600)}`,
    )

    const eventoLogistica = interpretarEventoLogisticaOlist(body)

    // Formato real capturado em produção:
    // { tipo: "nota_fiscal", dados: { idNotaFiscalTiny, chaveAcesso, ... } }
    // O payload não trouxe o pedido do e-commerce; por isso o serviço consulta
    // a nota na Olist e cruza id da venda, número e valor antes de preparar.
    if (eventoLogistica?.tipo === 'nota_fiscal') {
      const resultado = await processarNotaFiscalOlist({
        idNotaFiscal: eventoLogistica.idNotaFiscal,
        chaveRecebida: eventoLogistica.chaveAcesso,
      })
      console.log(
        `[webhook] NF-e ${eventoLogistica.idNotaFiscal}: ${resultado.motivo}` +
          (resultado.orderNumber ? ` (${resultado.orderNumber})` : ''),
      )
      return NextResponse.json({ ok: true, ...resultado })
    }

    // ── Atualização de estoque ─────────────────────────────────────────────
    // Tiny dispara quando estoque muda no depósito
    if (
      evento === 'produto.estoque' ||
      evento === 'estoque.atualizado' ||
      evento === 'stock.updated' ||
      (tipo === 'produto' && body.dados?.estoque !== undefined) ||
      (tipo === 'estoque')
    ) {
      // Formato real do Olist, capturado em produção (10/08/2026):
      //   {"tipo":"estoque","dados":{"idProduto":843774238,"sku":"167",
      //    "nome":"PNEU ...","saldo":8}}
      // O campo é `idProduto` — era por isso que 180 eventos entravam aqui e
      // saíam sem sincronizar nada: `dados.id` é undefined e o `if` não passava.
      const id = body.dados?.idProduto || body.dados?.id || body.data?.id || body.id
      if (!id) {
        console.warn(`[webhook] evento de estoque sem id de produto: ${payloadSeguroParaLog(body, 300)}`)
        return NextResponse.json({ ok: true, ignorado: 'sem idProduto' })
      }

      // Se o produto ainda não existe no site, cria na hora (traz imagem,
      // preço e dados completos) — o Tiny não tem webhook de "produto criado",
      // então o 1º lançamento de estoque é o gatilho de importação em tempo real.
      const jaExiste = await prisma.product.findFirst({
        where: { tinyId: String(id) },
        select: { id: true },
      })
      if (!jaExiste) {
        const r = await syncProdutoUnico(id)
        console.log(`[webhook] Produto ${id} NOVO importado via estoque (${r})`)
      } else {
        const novoEstoque = await syncEstoqueProduto(id)
        console.log(`[webhook] Estoque produto ${id} → ${novoEstoque}`)
      }
      return NextResponse.json({ ok: true })
    }

    // ── Produto criado ou alterado ──────────────────────────────────────────
    if (
      evento === 'produto.criado' ||
      evento === 'produto.alterado' ||
      tipo === 'produto' ||
      evento === 'product.created' ||
      evento === 'product.updated'
    ) {
      const id = body.dados?.id || body.data?.id || body.id
      if (id) {
        // Sincroniza dados completos (inclui estoque real)
        await syncProdutoUnico(id)
        // Também atualiza estoque via endpoint específico (mais preciso)
        await syncEstoqueProduto(id).catch(() => {})
        console.log(`[webhook] Produto ${id} sincronizado (${evento})`)
      }
      return NextResponse.json({ ok: true })
    }

    // ── Atualização de pedido ───────────────────────────────────────────────
    if (
      evento === 'order.updated' ||
      evento === 'pedido.atualizado' ||
      (tipo === 'pedido' && (body.dados?.situacao || body.dados?.codigoSituacao)) ||
      eventoLogistica?.tipo === 'atualizacao_pedido'
    ) {
      const olistId = String(
        eventoLogistica?.tipo === 'atualizacao_pedido'
          ? eventoLogistica.olistOrderId
          : body.dados?.id || body.data?.id || body.id || ''
      )
      const statusKey = eventoLogistica?.tipo === 'atualizacao_pedido'
        ? eventoLogistica.situacao
        : body.dados?.codigoSituacao || body.dados?.descricaoSituacao ||
          body.dados?.situacao || body.data?.status || ''
      const novoStatus = eventoLogistica?.tipo === 'atualizacao_pedido'
        ? eventoLogistica.statusInterno
        : statusInternoDaSituacaoOlist(statusKey)

      // O evento de atualização com situação faturada é uma segunda chance
      // imediata. Repetir é seguro: chave, tracking e remessa são idempotentes.
      const idNotaFiscal = eventoLogistica?.tipo === 'atualizacao_pedido'
        ? eventoLogistica.idNotaFiscal
        : String(body.dados?.idNotaFiscal ?? body.dados?.id_nota_fiscal ?? '') || null
      if (idNotaFiscal && normalizarSituacaoOlist(statusKey) === 'faturado') {
        await processarNotaFiscalOlist({
          idNotaFiscal,
          olistOrderId: olistId,
        })
      }

      // Tenta capturar tracking code de várias estruturas possíveis do Tiny/Olist
      const trackingCode =
        body.dados?.codigo_rastreamento ||
        body.dados?.rastreamento?.codigo ||
        body.dados?.objeto_correios ||
        body.data?.tracking_code ||
        body.data?.tracking?.code ||
        null
      const transportadora =
        body.dados?.transportadora?.nome ||
        body.dados?.transportadora ||
        body.data?.shipping?.carrier ||
        null

      if (olistId && novoStatus) {
        const pedido = await prisma.order.findFirst({
          where: { olistOrderId: olistId },
          select: {
            id: true,
            status: true,
            trackingCode: true,
            freteTransportadora: true,
            freteServico: true,
            fretePrazo: true,
            orderNumber: true,
            updatedAt: true,
            userId: true,
            enderecoEntrega: true,
            user: {
              select: {
                nome: true,
                telefone: true,
                email: true,
              }
            }
          },
        })

        if (pedido) {
          // Cancelar o pedido no ERP não estorna automaticamente o pagamento.
          // Mantemos o pedido pago e registramos a divergência para tratamento
          // administrativo; o endpoint de cancelamento é quem executa a
          // compensação financeira e de estoque.
          if (novoStatus === 'CANCELADO' && pedido.status !== 'CANCELADO') {
            const jaRegistrado = await prisma.orderTracking.findFirst({
              where: {
                orderId: pedido.id,
                descricao: { contains: 'cancelado no Olist/Tiny' },
              },
              select: { id: true },
            })
            if (!jaRegistrado) {
              await prisma.orderTracking.create({
                data: {
                  orderId: pedido.id,
                  status: pedido.status,
                  descricao: '⚠️ Pedido cancelado no Olist/Tiny; pagamento e pedido local preservados até compensação administrativa.',
                },
              })
            }
            return NextResponse.json({ ok: true, requer_compensacao: true })
          }

          const avancaStatus =
            pedido.status !== 'CANCELADO' &&
            novoStatus !== 'CANCELADO' &&
            (ORDEM_STATUS[novoStatus] ?? -1) > (ORDEM_STATUS[pedido.status] ?? -1)
          const novoRastreio = Boolean(trackingCode && !pedido.trackingCode)
          const novaTransportadora = Boolean(transportadora && !pedido.freteTransportadora)

          if (!avancaStatus && !novoRastreio && !novaTransportadora) {
            return NextResponse.json({ ok: true, semMudanca: true })
          }

          const desc: string[] = [`Status atualizado via webhook OLIST/Tiny: ${statusKey}`]
          if (novoRastreio) {
            desc.push(`Código de rastreamento: ${trackingCode}`)
          }

          // updatedAt funciona como versão otimista: duas entregas concorrentes
          // não disparam duas atualizações/notificações.
          const atualizado = await prisma.$transaction(async (tx) => {
            const claim = await tx.order.updateMany({
              where: { id: pedido.id, updatedAt: pedido.updatedAt },
              data: {
                ...(avancaStatus && { status: novoStatus as any }),
                ...(novoRastreio && { trackingCode: String(trackingCode) }),
                ...(novaTransportadora && { freteTransportadora: String(transportadora) }),
              },
            })
            if (claim.count === 0) return false
            await tx.orderTracking.create({
              data: {
                orderId: pedido.id,
                status: (avancaStatus ? novoStatus : pedido.status) as any,
                descricao: desc.join(' | '),
              },
            })
            return true
          })
          if (!atualizado) return NextResponse.json({ ok: true, concorrente: true })

          console.log(
            `[webhook] Pedido ${olistId} → ${avancaStatus ? novoStatus : pedido.status}` +
              (trackingCode ? ` (rastreio: ${trackingCode})` : '')
          )

          if (avancaStatus && novoStatus === 'ENVIADO' && pedido.freteServico === 'retirada') {
            const endereco = (pedido.enderecoEntrega ?? {}) as Record<string, unknown>
            const nome = String(endereco.nome ?? pedido.user?.nome ?? 'Cliente')
            const telefone = endereco.telefone ?? pedido.user?.telefone
            const email = endereco.email ?? pedido.user?.email

            if (telefone && endereco.whatsappTransacionalAutorizado === true) {
              const { enfileirarMensagem } = await import('@/lib/evolution/queue')
              const { normalizarWhatsApp } = await import('@/lib/evolution/client')
              const { msgPedidoProntoRetirada } = await import('@/lib/evolution/templates')
              const whatsapp = normalizarWhatsApp(String(telefone))
              const lead = await prisma.crmLead.findFirst({ where: { whatsapp }, select: { id: true } })
              await enfileirarMensagem({
                chaveIdempotencia: `pedido:${pedido.id}:whatsapp:pronto-retirada`,
                whatsapp,
                nome,
                tipo: 'MANUAL',
                leadId: lead?.id,
                userId: pedido.userId ?? undefined,
                payload: { conteudo: msgPedidoProntoRetirada(nome, pedido.orderNumber) },
              }).catch(() => {})
            }
            if (email) {
              const { enviarEmailProntoRetirada } = await import('@/lib/email/send')
              await enviarEmailProntoRetirada({
                para: String(email),
                nomeCliente: nome,
                numeroPedido: pedido.orderNumber,
              }).catch((error) => {
                console.error('[olist-webhook] falha no e-mail de retirada:', error)
              })
            }
          } else if (avancaStatus && (novoStatus === 'ENVIADO' || novoStatus === 'ENTREGUE')) {
            await agendarNotificacoesEtapaPedido(
              pedido.id,
              novoStatus === 'ENTREGUE' ? 'PEDIDO_ENTREGUE' : 'PEDIDO_ENVIADO',
            ).catch((error) => {
              console.error(
                `[olist-webhook] notificação ${novoStatus} pendente para ${pedido.orderNumber}:`,
                error instanceof Error ? error.message : 'falha desconhecida',
              )
            })
          }
        }
      }
      return NextResponse.json({ ok: true })
    }

    // Evento desconhecido — retorna 200 para não reprocessar, mas grita no log
    // com o payload inteiro: é o que permite descobrir o formato real que o
    // Olist manda e passar a tratá-lo.
    console.warn(
      `[webhook] EVENTO NÃO TRATADO evento="${evento}" tipo="${tipo}" payload=${payloadSeguroParaLog(body, 800)}`,
    )
    return NextResponse.json({ ok: true, evento_ignorado: evento })
  } catch (e) {
    console.error('[webhook] Erro:', e)
    return NextResponse.json({ error: 'falha temporária' }, { status: 500 })
  }
}
