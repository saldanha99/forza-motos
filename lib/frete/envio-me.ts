/**
 * Envio pelo Melhor Envio, direto do site — sem depender do Olist.
 *
 * Fluxo SEMI-AUTOMÁTICO (decidido com o Caio em 06/08/2026):
 *
 *   pagamento aprovado  →  adicionarPedidoAoCarrinho()   ← automático, NÃO gasta
 *   admin confere       →  comprarEtiquetaDoPedido()     ← clique manual, GASTA
 *
 * A separação existe porque comprar etiqueta debita saldo real da conta ME.
 * Nada aqui compra sozinho.
 */

import { prisma } from '@/lib/prisma'
import { dimensoesDoCarrinho } from './dimensoes'
import {
  adicionarAoCarrinhoME,
  comprarEtiquetasME,
  gerarEtiquetasME,
  imprimirEtiquetasME,
  rastrearEtiquetasME,
} from './melhor-envio'

/** Etapas do envio, na ordem em que acontecem */
export type EnvioStatus = 'CARRINHO' | 'COMPRADA' | 'GERADA'

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

/** Pedido retirado na loja não gera envio nenhum */
function ehRetirada(freteServico: string | null): boolean {
  return !freteServico || freteServico === 'retirada'
}

/**
 * Coloca o pedido no carrinho do Melhor Envio já preenchido (destinatário,
 * volumes e serviço escolhido pelo cliente na cotação).
 *
 * Idempotente: se o pedido já tem `melhorEnvioId`, devolve o existente sem
 * criar outro — o webhook do Mercado Pago pode reentrar.
 */
export async function adicionarPedidoAoCarrinho(
  orderId: string,
): Promise<{ criado: boolean; melhorEnvioId: string | null; motivo?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, user: true },
  })
  if (!order) throw new Error('Pedido não encontrado')

  if (order.melhorEnvioId) {
    return { criado: false, melhorEnvioId: order.melhorEnvioId, motivo: 'já estava no carrinho' }
  }
  if (ehRetirada(order.freteServico)) {
    return { criado: false, melhorEnvioId: null, motivo: 'retirada na loja — sem envio' }
  }

  // freteServico guarda o id do serviço do ME, vindo da cotação que o cliente
  // escolheu. Se não for numérico, veio do fallback dos Correios e o ME não
  // sabe o que fazer com ele.
  const servicoId = Number(order.freteServico)
  if (!Number.isFinite(servicoId) || servicoId <= 0) {
    return {
      criado: false,
      melhorEnvioId: null,
      motivo: `serviço "${order.freteServico}" não é do Melhor Envio (cotação de fallback)`,
    }
  }

  const endereco = (order.enderecoEntrega ?? {}) as any
  const documento = soDigitos(order.user?.cpf ?? endereco.cpf)
  if (!documento) {
    throw new Error('CPF ausente no pedido — o Melhor Envio exige documento do destinatário')
  }

  const dimensoes = dimensoesDoCarrinho(
    order.items.map((i) => ({
      quantidade: i.quantidade,
      produto: {
        categoria: i.product.categoria,
        peso: i.product.peso ? Number(i.product.peso) : null,
        altura: i.product.altura ? Number(i.product.altura) : null,
        largura: i.product.largura ? Number(i.product.largura) : null,
        comprimento: i.product.comprimento ? Number(i.product.comprimento) : null,
      },
    })),
  )

  const resposta = await adicionarAoCarrinhoME({
    servicoId,
    cepDestino: soDigitos(endereco.cep),
    dimensoes,
    // Valor segurado = mercadoria, sem o frete
    valorTotal: Number(order.subtotal),
    destinatario: {
      nome: order.user?.nome ?? endereco.nome ?? 'Cliente',
      email: order.user?.email ?? endereco.email ?? '',
      telefone: soDigitos(order.user?.telefone ?? endereco.telefone),
      documento,
      enderecoCompleto: {
        rua: endereco.rua ?? '',
        numero: String(endereco.numero ?? 'S/N'),
        complemento: endereco.complemento ?? '',
        bairro: endereco.bairro ?? '',
        cidade: endereco.cidade ?? '',
        estado: endereco.estado ?? '',
      },
    },
  })

  const melhorEnvioId = resposta?.id ? String(resposta.id) : null
  if (!melhorEnvioId) {
    throw new Error(`Melhor Envio não devolveu id do envio: ${JSON.stringify(resposta).slice(0, 200)}`)
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { melhorEnvioId, melhorEnvioStatus: 'CARRINHO' satisfies EnvioStatus },
  })

  await prisma.orderTracking.create({
    data: {
      orderId: order.id,
      status: order.status,
      descricao: `Envio preparado no Melhor Envio (${melhorEnvioId}). Aguardando compra da etiqueta.`,
    },
  })

  return { criado: true, melhorEnvioId }
}

/**
 * Compra a etiqueta, gera o PDF e captura o rastreio. GASTA SALDO — só deve ser
 * chamada a partir de uma ação explícita do admin.
 *
 * Tolerante a reentrada: um pedido já comprado avança direto para gerar/imprimir
 * em vez de comprar de novo.
 */
export async function comprarEtiquetaDoPedido(orderId: string): Promise<{
  melhorEnvioId: string
  etiquetaUrl: string | null
  rastreio: string | null
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, melhorEnvioId: true, melhorEnvioStatus: true, trackingCode: true },
  })
  if (!order) throw new Error('Pedido não encontrado')
  if (!order.melhorEnvioId) {
    throw new Error('Pedido não está no carrinho do Melhor Envio — adicione primeiro')
  }

  const ids = [order.melhorEnvioId]

  if (order.melhorEnvioStatus === 'CARRINHO') {
    await comprarEtiquetasME(ids)
    await prisma.order.update({
      where: { id: order.id },
      data: { melhorEnvioStatus: 'COMPRADA' satisfies EnvioStatus },
    })
  }

  // Gerar é idempotente do lado do ME: etiqueta já gerada volta sem erro
  await gerarEtiquetasME(ids)
  const impressao = await imprimirEtiquetasME(ids)
  const etiquetaUrl = impressao?.url ?? null

  // Rastreio pode ainda não existir no instante da compra — não é motivo de falha
  let rastreio: string | null = null
  try {
    const tracking = await rastrearEtiquetasME(ids)
    const dados = tracking?.[order.melhorEnvioId]
    rastreio = dados?.tracking ?? dados?.melhorenvio_tracking ?? null
  } catch (e) {
    console.error('[envio-me] rastreio ainda indisponível:', e)
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      melhorEnvioStatus: 'GERADA' satisfies EnvioStatus,
      ...(etiquetaUrl && { melhorEnvioEtiqueta: etiquetaUrl }),
      ...(rastreio && !order.trackingCode && { trackingCode: rastreio }),
    },
  })

  await prisma.orderTracking.create({
    data: {
      orderId: order.id,
      status: 'SEPARANDO',
      descricao:
        `Etiqueta comprada no Melhor Envio.` +
        (rastreio ? ` Rastreio: ${rastreio}.` : ' Rastreio ainda não disponível.'),
    },
  })

  return { melhorEnvioId: order.melhorEnvioId, etiquetaUrl, rastreio }
}
