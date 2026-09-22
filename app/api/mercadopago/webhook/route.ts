import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { triggerIndexing } from '@/lib/seo/indexing'
import { SEO_CONFIG } from '@/lib/seo/config'
import { validarAssinaturaMP } from '@/lib/mercadopago'
import { processarPagamentoPedido } from '@/lib/checkout/webhook-pagamento'
import { cancelarPedidoComCompensacao } from '@/lib/checkout/reserva'
import {
  consultarPagamentoMP,
  ErroConsultaPagamentoMP,
  ErroValidacaoPagamentoMP,
  validarRecebedorPagamentoMP,
} from '@/lib/checkout/mercadopago-webhook'
import { efeitosPedidoConfirmado } from '@/lib/checkout/efeitos-pedido-confirmado'
import { enfileirarMensagem } from '@/lib/evolution/queue'
import { enviarMensagem } from '@/lib/evolution/client'
import { processarPagamentoEvento } from '@/lib/eventos/pagamento'
import { notificarAprovacaoEvento } from '@/lib/eventos/notificacoes'
import { EventoCheckoutError } from '@/lib/eventos/checkout'
import { reverterBeneficiosPedidoPirelliCancelado } from '@/lib/checkout/beneficios-evento-pirelli'
import { bloquearVisitanteEvento } from '@/lib/evento-pirelli'

/**
 * Webhook do Mercado Pago.
 *
 * Contrato de resposta (ver Fix P1.4):
 *   - 200 só quando o evento foi efetivamente processado ou é irrelevante.
 *   - 401 para assinatura inválida.
 *   - 5xx para QUALQUER falha recuperável (MP fora do ar, banco indisponível).
 *     Um 200 prematuro faz o MP nunca reentregar, e o evento se perde.
 *
 * A máquina de estados do pedido vive em lib/checkout/webhook-pagamento.ts;
 * aqui ficam só o transporte e os efeitos colaterais (Olist, e-mail, WhatsApp).
 */

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Suporte a dois formatos de webhook do MP:
    //   Novo: { type: 'payment', data: { id: '123' } }
    //   Antigo: { topic: 'payment', id: '123' }
    // Qualquer outro tipo (merchant_order, etc.) é ignorado.
    const isNewFormat  = body.type === 'payment'
    const isOldFormat  = body.topic === 'payment'
    if (!isNewFormat && !isOldFormat) {
      return NextResponse.json({ ok: true, ignored: body.type ?? body.topic })
    }

    const paymentId = isNewFormat ? body.data?.id : body.id
    if (!paymentId) return NextResponse.json({ ok: true })

    // Valida a assinatura HMAC do Mercado Pago (anti-spoofing/replay).
    // Fail-closed: sem MERCADOPAGO_WEBHOOK_SECRET configurado o endpoint
    // rejeita tudo (ver lib/mercadopago.ts).
    const assinaturaOk = validarAssinaturaMP({
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId: String(paymentId),
    })
    if (!assinaturaOk) {
      console.warn('[mp-webhook] Assinatura inválida — requisição rejeitada')
      return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 })
    }

    // Consulta e normaliza a representação oficial. A normalização também
    // resolve preference_id via merchant order quando o GET de payment não a
    // traz diretamente.
    const payment = await consultarPagamentoMP(String(paymentId))
    if (!payment) {
      // A notificação pode vencer a consistência do GET. 5xx força reentrega;
      // um ACK aqui poderia perder definitivamente um pagamento real.
      throw new ErroConsultaPagamentoMP(`Pagamento assinado ${paymentId} ainda não localizado`, 404)
    }
    await validarRecebedorPagamentoMP(payment)

    const externalRef = payment.external_reference
    if (!externalRef) return NextResponse.json({ ok: true })

    // ── PAGAMENTO DE INGRESSO ─────────────────────────────────────────────
    if (externalRef.startsWith('evento_')) {
      const resultadoEvento = await processarPagamentoEvento(payment)
      if (resultadoEvento.tipo === 'evento_desconhecido') {
        await alertarAdmin(
          `🚨 *PAGAMENTO DE EVENTO ÓRFÃO — Forza Motos*\n\n` +
            `Pagamento: ${payment.id}\nReferência: ${externalRef}\n\n` +
            `A inscrição interna não foi localizada; investigar antes de reconhecer a notificação.`,
        )
        throw new ErroValidacaoPagamentoMP('INSCRICAO_INTERNA_DESCONHECIDA')
      }

      if (
        resultadoEvento.notificarAprovacao &&
        process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS !== 'false'
      ) {
        await notificarAprovacaoEvento(resultadoEvento.inscricao)
      }
      if (
        resultadoEvento.reembolsoAgendado &&
        process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS !== 'false'
      ) {
        await alertarAdmin(
          `⚠️ *ESTORNO DE EVENTO AGENDADO — Forza Motos*\n\n` +
            `Inscrição: ${resultadoEvento.inscricao.id}\n` +
            `Pagamento: ${payment.id}\n` +
          `A outbox durável continuará tentando até confirmação.`,
        )
      }
      if (
        resultadoEvento.statusPagamentoAlterado &&
        ['in_mediation', 'charged_back', 'refunded'].includes(payment.status) &&
        process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS !== 'false'
      ) {
        const rotulo = payment.status === 'in_mediation'
          ? 'DISPUTA ABERTA'
          : payment.status === 'charged_back'
            ? 'CHARGEBACK'
            : 'ESTORNO CONFIRMADO'
        await alertarAdmin(
          `🚨 *${rotulo} EM PAGAMENTO DE EVENTO*\n\n` +
            `Evento: ${resultadoEvento.inscricao.evento.titulo}\n` +
            `Inscrição: ${resultadoEvento.inscricao.id}\n` +
            `Participante: ${resultadoEvento.inscricao.nome}\n` +
            `Pagamento: ${payment.id}\nStatus: ${payment.status}\n\n` +
            `Conferir imediatamente no painel do Mercado Pago.`,
        )
      }
      return NextResponse.json({
        ok: true,
        tipo: 'evento',
        status: resultadoEvento.status,
        reembolsoAgendado: resultadoEvento.reembolsoAgendado,
      })
    }

    // ── PAGAMENTO DE PEDIDO (ecommerce) ───────────────────────────────────
    const orderId = externalRef

    // A máquina central valida external_reference, BRL, valor, preferência e
    // recebedor antes de registrar QUALQUER status financeiro.
    const resultado = await processarPagamentoPedido(orderId, String(paymentId), payment)
    if (resultado.tipo === 'pedido_desconhecido') {
      if (/^c[a-z0-9]{20,35}$/i.test(orderId)) {
        await alertarAdmin(
          `🚨 *PAGAMENTO ÓRFÃO — Forza Motos*\n\n` +
            `Pagamento: ${paymentId}\nReferência interna: ${orderId}\n\n` +
            `O pedido não foi localizado. Investigar antes de reconhecer a notificação.`,
        )
        throw new ErroValidacaoPagamentoMP('PEDIDO_INTERNO_DESCONHECIDO')
      }
      return NextResponse.json({ ok: true, ignored: 'external_reference_not_internal' })
    }

    // ── CHARGEBACK / DISPUTA / ESTORNO ─────────────────────────────────────
    if (
      payment.status === 'charged_back' ||
      payment.status === 'in_mediation' ||
      payment.status === 'refunded'
    ) {
      const pedido = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          orderNumber: true,
          status: true,
          total: true,
          trackingCode: true,
          eventoPirelliVisitanteId: true,
        },
      })
      if (!pedido) throw new ErroValidacaoPagamentoMP('PEDIDO_INTERNO_DESCONHECIDO')

      const marcador = `DISPUTA:${payment.status}`
      const rotulo =
        payment.status === 'charged_back'
          ? '🚨 CHARGEBACK (possível cartão clonado)'
          : payment.status === 'in_mediation'
            ? '⚠️ DISPUTA aberta pelo comprador'
            : '↩️ ESTORNO efetivado'

      // Se esta era a cobrança extra de uma duplicidade, sua reversão fecha
      // apenas o estorno extra; a compra principal continua válida.
      const outroPagamentoAprovado = await prisma.pagamentoTentativa.findFirst({
        where: {
          orderId,
          status: 'approved',
          paymentId: { not: String(paymentId) },
        },
        select: { paymentId: true },
      })
      const reversaoDeCobrancaExtra = Boolean(outroPagamentoAprovado)

      if (
        (payment.status === 'refunded' || payment.status === 'charged_back') &&
        !reversaoDeCobrancaExtra
      ) {
        if (pedido.status === 'AGUARDANDO_PAGAMENTO') {
          await cancelarPedidoComCompensacao(
            orderId,
            `${rotulo} — recursos reservados devolvidos; não despachar.`,
          )
        } else {
          // Estoque físico não é somado: o Olist pode já ter movimentado a
          // venda. A operação fica cancelada e exige conferência física.
          await prisma.$transaction(async (tx) => {
            if (pedido.eventoPirelliVisitanteId) {
              await bloquearVisitanteEvento(tx, pedido.eventoPirelliVisitanteId)
            }
            const cancelado = await tx.order.updateMany({
              where: { id: orderId, status: { in: ['CONFIRMADO', 'SEPARANDO'] } },
              data: { status: 'CANCELADO', pagamentoResultadoIncerto: false },
            })
            if (!cancelado.count) return
            await reverterBeneficiosPedidoPirelliCancelado(tx, orderId, {
              por: 'Mercado Pago',
              motivo: `${rotulo} — pagamento ${paymentId}.`,
            })
          })
        }
      }

      // Este update não depende do marcador de comunicação. Se o processo cair
      // após gravar o tracking, uma reentrega ainda conclui a outbox.
      if (payment.status === 'refunded') {
        await prisma.reembolsoPagamento.updateMany({
          where: { paymentId: String(paymentId), status: 'PENDENTE' },
          data: { status: 'CONCLUIDO', concluidoEm: new Date(), proximaTentativaEm: null },
        })
      }

      const jaRegistrado = await prisma.orderTracking.findFirst({
        where: { orderId, status: marcador },
        select: { id: true },
      })
      if (!jaRegistrado) {
        await prisma.orderTracking.create({
          data: {
            orderId,
            status: marcador,
            descricao: `${rotulo} — pagamento ${paymentId}. Conferir no painel do Mercado Pago.`,
          },
        })

        if (process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS !== 'false') {
          const aindaNaoDespachado = ['AGUARDANDO_PAGAMENTO', 'CONFIRMADO', 'SEPARANDO']
            .includes(pedido.status)
          const totalFmt = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(Number(pedido.total ?? 0))
          const instrucao = reversaoDeCobrancaExtra
            ? '\n✅ A compra principal permanece válida; esta era a cobrança extra.\n'
            : aindaNaoDespachado
              ? '\n⛔ *NÃO DESPACHAR este pedido!*\n'
              : `\n📦 Pedido já despachado${pedido.trackingCode ? ` (rastreio ${pedido.trackingCode})` : ''}.\n`
          const msg =
            `${rotulo} — *Forza Motos*\n\n` +
            `📦 Pedido: ${pedido.orderNumber}\n` +
            `💰 Valor: ${totalFmt}\n` +
            instrucao +
            '\n👉 Conferir a ocorrência no painel do Mercado Pago e anexar NF/rastreio quando solicitado.\n' +
            'https://www.mercadopago.com.br/reclamos-ventas'

          const adminPhone = process.env.ADMIN_WHATSAPP ?? '5519974049445'
          const direto = await enviarMensagem({
            whatsapp: adminPhone,
            mensagem: msg,
          }).catch(() => ({ ok: false }))
          if (!direto.ok) {
            await enfileirarMensagem({
              whatsapp: adminPhone,
              nome: 'Admin',
              tipo: 'MANUAL',
              payload: { conteudo: msg },
            }).catch((error) => console.error('[mp-webhook] Falha ao enfileirar alerta:', error))
          }
        }
      }
      return NextResponse.json({ ok: true, status: payment.status })
    }

    if (resultado.tipo === 'ja_processado') {
      // Se o processo caiu entre a confirmação e um efeito externo, a
      // reentrega completa apenas os efeitos ainda sem marcador.
      if (payment.status === 'approved') {
        await efeitosPedidoConfirmado(orderId, payment.payment_method_id)
      }
      return NextResponse.json({ ok: true, status: 'already_processed', pedido: resultado.status })
    }

    if (resultado.tipo === 'tentativa_nao_aprovada') {
      // Nada é desfeito aqui: a reserva só volta na expiração (reconciliação).
      return NextResponse.json({ ok: true, status: resultado.status, tentativaRegistrada: resultado.novo })
    }

    if (resultado.tipo === 'aprovado_apos_encerramento') {
      await alertarAdmin(
        `🚨 *PAGAMENTO APROVADO SOBRE PEDIDO ENCERRADO — Forza Motos*\n\n` +
          `📦 Pedido: ${orderId}\n` +
          `💳 Pagamento: ${paymentId}\n` +
          `↩️ Estorno: ${resultado.estorno}\n\n` +
          `👉 Conferir no painel do MP; o estorno é reconciliado automaticamente ` +
          `enquanto estiver PENDENTE.`,
      )
      return NextResponse.json({ ok: true, status: 'refund_scheduled', estorno: resultado.estorno })
    }

    if (resultado.tipo === 'aprovacao_duplicada') {
      await alertarAdmin(
        `🚨 *COBRANÇA DUPLICADA — Forza Motos*\n\n` +
          `📦 Pedido: ${orderId}\n` +
          `💳 Pagamento extra: ${paymentId}\n` +
          `↩️ Estorno: ${resultado.estorno}\n\n` +
          `A cobrança principal foi preservada; apenas a cobrança extra será devolvida.`,
      )
      return NextResponse.json({ ok: true, status: 'duplicate_refund_scheduled', estorno: resultado.estorno })
    }

    if (resultado.tipo === 'metodo_pagamento_invalido') {
      await alertarAdmin(
        `🚨 *MEIO DE PAGAMENTO INCOMPATÍVEL — Forza Motos*\n\n` +
          `📦 Pedido: ${orderId}\n` +
          `💳 Meio recebido: ${resultado.metodo}\n` +
          `✅ Modalidade esperada: ${resultado.esperado}\n` +
          `↩️ Estorno: ${resultado.estorno}\n\n` +
          `O pagamento foi incompatível com a modalidade usada para calcular o total.`,
      )
      return NextResponse.json({ ok: true, status: 'invalid_method_refund_scheduled', estorno: resultado.estorno })
    }

    if (resultado.tipo === 'cancelado_sem_estoque') {
      console.warn(`[mp-webhook] ⚠️ Estoque insuficiente após pagamento — pedido ${orderId}: ${resultado.nomes}`)
      await alertarAdmin(
        `🚨 *PEDIDO PAGO SEM ESTOQUE — Forza Motos*\n\n` +
          `📦 Pedido: ${orderId}\n` +
          `💳 Pagamento: ${paymentId}\n` +
          `📦 Esgotado(s): ${resultado.nomes}\n` +
          `↩️ Estorno: ${resultado.estorno}\n\n` +
          (resultado.estorno === 'CONCLUIDO'
            ? `✅ Estorno total confirmado pelo Mercado Pago.`
            : `⚠️ Estorno NÃO confirmado ainda — a reconciliação continua tentando. Acompanhar no painel do MP.`),
      )
      triggerIndexing(`${SEO_CONFIG.siteUrl}/pedidos/${orderId}`, {
        action: 'URL_DELETED',
        origem: 'mp-webhook-cancel',
      })
      return NextResponse.json({ ok: true, status: 'cancelled_no_stock', estorno: resultado.estorno })
    }

    // ── CONFIRMADO: efeitos colaterais ────────────────────────────────────
    await efeitosPedidoConfirmado(orderId, payment.payment_method_id)
    return NextResponse.json({ ok: true, status: 'approved' })
  } catch (e) {
    console.error('Webhook MP erro:', e)
    if (e instanceof EventoCheckoutError) {
      return NextResponse.json({ error: e.code }, { status: e.status })
    }
    if (e instanceof ErroValidacaoPagamentoMP) {
      return NextResponse.json({ error: 'pagamento divergente' }, { status: 409 })
    }
    if (e instanceof ErroConsultaPagamentoMP) {
      return NextResponse.json({ error: 'Mercado Pago temporariamente indisponível' }, { status: 503 })
    }
    // 5xx faz o MP reentregar. Nunca ACK sobre falha recuperável (Fix P1.4).
    return NextResponse.json({ error: 'falha ao processar webhook' }, { status: 500 })
  }
}

async function alertarAdmin(mensagem: string) {
  const adminPhone = process.env.ADMIN_WHATSAPP ?? '5519974049445'
  await enfileirarMensagem({
    whatsapp: adminPhone,
    nome: 'Admin',
    tipo: 'MANUAL',
    payload: { conteudo: mensagem },
  }).catch((e) => console.error('[mp-webhook] Falha ao notificar admin:', e))
}
