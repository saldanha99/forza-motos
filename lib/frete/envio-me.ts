/**
 * Envio pelo Melhor Envio, direto do site — sem depender do Olist.
 *
 * admin registra NF-e → adicionarPedidoAoCarrinho()  (não gasta)
 * clique do admin     → comprarEtiquetaDoPedido()    (gasta saldo real)
 */

import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { dimensoesDoCarrinho } from './dimensoes'
import { executarComLease } from './operacao-com-lease'
import { exigirChaveNfe, exigirInscricaoEstadual } from './nfe'
import { ehServicoMelhorEnvio } from './servico'
import { gerarEObterImpressao } from './geracao-etiqueta'
import { analisarEstadoEnvioRemoto, type EnvioStatus } from './estado-envio'
import { calcularMercadoriasLiquidas } from './valores-mercadoria'
import {
  adicionarAoCarrinhoME,
  buscarEnvioNoCarrinhoPorTag,
  comprarEtiquetasME,
  consultarEnvioME,
  gerarEtiquetasME,
  imprimirEtiquetasME,
  rastrearEtiquetasME,
  resultadoCompraPodeSerIncerto,
  SERVICOS_CORREIOS_LOJA,
  servicoCompativelComFluxo,
} from './melhor-envio'

export type { EnvioStatus } from './estado-envio'

const LEASE_MS = 5 * 60 * 1000
const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

function ehRetirada(freteServico: string | null): boolean {
  return !freteServico || freteServico === 'retirada'
}

/** Compare-and-swap: só um processo pode falar com o ME por pedido. */
async function adquirirLease(orderId: string, operacao: 'CARRINHO' | 'ETIQUETA', exigeId: boolean) {
  const token = `${operacao}:${randomUUID()}`
  const agora = new Date()
  const adquirido = await prisma.order.updateMany({
    where: {
      id: orderId,
      ...(operacao === 'CARRINHO' && { status: { in: ['CONFIRMADO', 'SEPARANDO'] as const } }),
      ...(exigeId ? { melhorEnvioId: { not: null } } : { melhorEnvioId: null }),
      OR: [
        { melhorEnvioSyncStatus: null },
        { melhorEnvioSyncExpiraEm: { lte: agora } },
      ],
    },
    data: {
      melhorEnvioSyncStatus: token,
      melhorEnvioSyncExpiraEm: new Date(agora.getTime() + LEASE_MS),
    },
  })
  return adquirido.count === 1 ? token : null
}

async function liberarLease(orderId: string, token: string) {
  await prisma.order.updateMany({
    where: { id: orderId, melhorEnvioSyncStatus: token },
    data: { melhorEnvioSyncStatus: null, melhorEnvioSyncExpiraEm: null },
  }).catch(() => {})
}

async function concluirLeaseComEstado(input: {
  orderId: string
  lease: string
  estado: EnvioStatus
  descricao: string
  etiquetaUrl?: string | null
  rastreio?: string | null
  marcarSeparando?: boolean
}): Promise<EnvioStatus> {
  const estadosPermitidos: Record<EnvioStatus, Array<EnvioStatus | null>> = {
    CARRINHO: [null, 'CARRINHO'],
    COMPRA_INCERTA: [null, 'CARRINHO', 'COMPRA_INCERTA'],
    COMPRADA: [null, 'CARRINHO', 'COMPRA_INCERTA', 'COMPRADA'],
    GERADA: [null, 'CARRINHO', 'COMPRA_INCERTA', 'COMPRADA', 'GERADA'],
    CANCELADA: [null, 'CARRINHO', 'COMPRA_INCERTA', 'COMPRADA', 'GERADA', 'CANCELADA'],
  }

  const estadoFinal = await prisma.$transaction(async (tx) => {
    const atual = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { status: true, melhorEnvioStatus: true },
    })
    if (!atual) return null

    const permitidos = estadosPermitidos[input.estado]
    const atualizado = await tx.order.updateMany({
      where: {
        id: input.orderId,
        melhorEnvioSyncStatus: input.lease,
        OR: [
          ...(permitidos.includes(null) ? [{ melhorEnvioStatus: null }] : []),
          { melhorEnvioStatus: { in: permitidos.filter((estado): estado is EnvioStatus => estado !== null) } },
        ],
      },
      data: {
        melhorEnvioStatus: input.estado,
        melhorEnvioSyncStatus: null,
        melhorEnvioSyncExpiraEm: null,
        ...(input.etiquetaUrl && { melhorEnvioEtiqueta: input.etiquetaUrl }),
      },
    })
    if (!atualizado.count) {
      // Um webhook pode ter avançado/cancelado o envio enquanto a operação
      // externa estava em andamento. Apenas libera o lease; nunca regride.
      const convergiu = await tx.order.findUnique({
        where: { id: input.orderId },
        select: { melhorEnvioStatus: true },
      })
      await tx.order.updateMany({
        where: { id: input.orderId, melhorEnvioSyncStatus: input.lease },
        data: { melhorEnvioSyncStatus: null, melhorEnvioSyncExpiraEm: null },
      })
      return convergiu?.melhorEnvioStatus as EnvioStatus | null
    }

    let atualizouRastreio = false
    if (input.rastreio) {
      const rastreio = await tx.order.updateMany({
        where: { id: input.orderId, trackingCode: null },
        data: { trackingCode: String(input.rastreio) },
      })
      atualizouRastreio = rastreio.count === 1
    }

    let atualizouSeparacao = false
    if (input.marcarSeparando && input.estado === 'GERADA') {
      const separacao = await tx.order.updateMany({
        where: { id: input.orderId, status: 'CONFIRMADO', melhorEnvioStatus: 'GERADA' },
        data: { status: 'SEPARANDO' },
      })
      atualizouSeparacao = separacao.count === 1
    }

    if (atual.melhorEnvioStatus !== input.estado || atualizouSeparacao || atualizouRastreio) {
      await tx.orderTracking.create({
        data: {
          orderId: input.orderId,
          status: atualizouSeparacao ? 'SEPARANDO' : atual.status,
          descricao: input.descricao,
        },
      })
    }
    return input.estado
  })
  if (!estadoFinal) throw new Error('Lease da etiqueta expirou antes da persistência')
  return estadoFinal
}

/**
 * Coloca o pedido no carrinho do Melhor Envio sem gastar saldo.
 *
 * O lease impede duas chamadas simultâneas. A tag estável recupera uma
 * etiqueta criada antes de uma queda entre a resposta externa e o update local.
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
  if (order.status !== 'CONFIRMADO' && order.status !== 'SEPARANDO') {
    throw new Error(`Pedido está ${order.status} — não preparar envio`)
  }
  if (ehRetirada(order.freteServico)) {
    return { criado: false, melhorEnvioId: null, motivo: 'retirada na loja — sem envio' }
  }

  if (!ehServicoMelhorEnvio(order.freteServico)) {
    return {
      criado: false,
      melhorEnvioId: null,
      motivo: `serviço "${order.freteServico}" não é do Melhor Envio (cotação de fallback)`,
    }
  }
  const servicoId = Number(order.freteServico)
  if (!(SERVICOS_CORREIOS_LOJA as readonly number[]).includes(servicoId)) {
    throw new Error('A loja permite preparar automaticamente somente Correios PAC ou SEDEX')
  }
  if (!servicoCompativelComFluxo({ id: servicoId })) {
    throw new Error(
      'Este serviço exige agência ou documento fiscal adicional e não pode ser emitido pelo fluxo atual',
    )
  }

  // Uma aprovação de pagamento não é documento fiscal. O carrinho comercial
  // só pode ser criado depois que um admin registra a chave da NF-e emitida.
  const nfeChave = exigirChaveNfe(order.nfeChave)
  exigirInscricaoEstadual(process.env.LOJA_INSCRICAO_ESTADUAL)

  const endereco = (order.enderecoEntrega ?? {}) as Record<string, any>
  const documento = soDigitos(order.user?.cpf ?? endereco.cpf)
  if (!documento) {
    throw new Error('CPF ausente no pedido — o Melhor Envio exige documento do destinatário')
  }

  const dimensoes = dimensoesDoCarrinho(
    order.items.map((item) => ({
      quantidade: item.quantidade,
      produto: {
        categoria: item.product.categoria,
        peso: item.product.peso ? Number(item.product.peso) : null,
        altura: item.product.altura ? Number(item.product.altura) : null,
        largura: item.product.largura ? Number(item.product.largura) : null,
        comprimento: item.product.comprimento ? Number(item.product.comprimento) : null,
      },
    })),
  )
  const mercadorias = calcularMercadoriasLiquidas({
    produtos: order.items.map((item) => ({
      nome: item.product.nome,
      quantidade: item.quantidade,
      valorUnitario: Number(item.precoUnitario),
    })),
    subtotal: Number(order.subtotal),
    desconto: Number(order.desconto),
  })

  const operacao = await executarComLease({
    adquirir: () => adquirirLease(order.id, 'CARRINHO', false),
    liberar: (token) => liberarLease(order.id, token),
    executar: async (lease) => {
      let melhorEnvioId = await buscarEnvioNoCarrinhoPorTag(order.orderNumber)
      let criado = false

      if (!melhorEnvioId) {
        const resposta = await adicionarAoCarrinhoME({
          servicoId,
          cepDestino: soDigitos(endereco.cep),
          nfeChave,
          dimensoes,
          valorTotal: mercadorias.valorTotal,
          produtos: mercadorias.produtos,
          referencia: {
            tag: order.orderNumber,
            url: `${process.env.NEXTAUTH_URL || 'https://www.forzamotos.com.br'}/admin/pedidos/${order.id}`,
          },
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
        melhorEnvioId = resposta?.id ? String(resposta.id) : null
        criado = true
      }

      if (!melhorEnvioId) throw new Error('Melhor Envio não devolveu o id do envio')
      const envioId = melhorEnvioId

      const persistiu = await prisma.$transaction(async (tx) => {
        const atualizado = await tx.order.updateMany({
          where: {
            id: order.id,
            melhorEnvioSyncStatus: lease,
            melhorEnvioId: null,
            status: { in: ['CONFIRMADO', 'SEPARANDO'] },
          },
          data: {
            melhorEnvioId: envioId,
            melhorEnvioStatus: 'CARRINHO' satisfies EnvioStatus,
            melhorEnvioSyncStatus: null,
            melhorEnvioSyncExpiraEm: null,
          },
        })
        if (!atualizado.count) return false
        await tx.orderTracking.create({
          data: {
            orderId: order.id,
            status: order.status,
            descricao: `Envio preparado no Melhor Envio (${envioId}). Aguardando compra da etiqueta.`,
          },
        })
        return true
      })
      if (!persistiu) {
        const atual = await prisma.order.findUnique({
          where: { id: order.id },
          select: { status: true },
        })
        if (atual && atual.status !== 'CONFIRMADO' && atual.status !== 'SEPARANDO') {
          await prisma.orderTracking.create({
            data: {
              orderId: order.id,
              status: atual.status,
              descricao: `Atenção: remessa ${envioId} criada sem cobrança no Melhor Envio, mas não vinculada porque o pedido mudou para ${atual.status}. Revisar o carrinho do Melhor Envio.`,
            },
          }).catch(() => {})
          throw new Error(`Pedido mudou para ${atual.status} durante o preparo; remessa não vinculada`)
        }
        throw new Error('Lease do Melhor Envio expirou antes da persistência')
      }

      return { criado, melhorEnvioId: envioId }
    },
  })

  if (operacao.adquirido) return operacao.valor

  const atual = await prisma.order.findUnique({
    where: { id: order.id },
    select: { melhorEnvioId: true },
  })
  return {
    criado: false,
    melhorEnvioId: atual?.melhorEnvioId ?? null,
    motivo: atual?.melhorEnvioId ? 'já estava no carrinho' : 'preparo do envio já está em andamento',
  }
}

/** Compra ou reconcilia a compra. Nunca gera a etiqueta nesta etapa. */
export async function comprarEtiquetaDoPedido(
  orderId: string,
  opcoes: { confirmarNovaTentativa?: boolean } = {},
): Promise<{
  melhorEnvioId: string
  status: EnvioStatus
  confirmado: boolean
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      melhorEnvioId: true,
      melhorEnvioStatus: true,
      nfeChave: true,
    },
  })
  if (!order) throw new Error('Pedido não encontrado')
  if (!order.melhorEnvioId) {
    throw new Error('Pedido não está no carrinho do Melhor Envio — adicione primeiro')
  }
  exigirChaveNfe(order.nfeChave)
  exigirInscricaoEstadual(process.env.LOJA_INSCRICAO_ESTADUAL)
  if (order.melhorEnvioStatus === 'GERADA' || order.melhorEnvioStatus === 'COMPRADA') {
    return {
      melhorEnvioId: order.melhorEnvioId,
      status: order.melhorEnvioStatus,
      confirmado: true,
    }
  }
  if (order.melhorEnvioStatus === 'CANCELADA') {
    throw new Error('A etiqueta deste envio foi cancelada no Melhor Envio')
  }

  const lease = await adquirirLease(order.id, 'ETIQUETA', true)
  if (!lease) {
    throw new Error('Compra/geração de etiqueta já está em andamento. Aguarde alguns instantes.')
  }

  const envioId = order.melhorEnvioId
  const ids = [envioId]
  try {
    // Consulta sempre antes de qualquer possível novo débito. Isso recupera
    // uma resposta perdida do checkout sem comprar a mesma etiqueta de novo.
    const remoto = analisarEstadoEnvioRemoto(await consultarEnvioME(envioId))
    if (remoto.cancelada) {
      const estado = await concluirLeaseComEstado({
        orderId: order.id,
        lease,
        estado: 'CANCELADA',
        descricao: 'Cancelamento da etiqueta confirmado no Melhor Envio.',
      })
      return { melhorEnvioId: envioId, status: estado, confirmado: false }
    }
    if (remoto.comprada) {
      const estado: EnvioStatus = remoto.gerada ? 'GERADA' : 'COMPRADA'
      const estadoFinal = await concluirLeaseComEstado({
        orderId: order.id,
        lease,
        estado,
        marcarSeparando: remoto.gerada,
        descricao: remoto.gerada
          ? 'Compra e geração da etiqueta confirmadas no Melhor Envio.'
          : 'Compra da etiqueta confirmada no Melhor Envio. Aguardando geração.',
      })
      return {
        melhorEnvioId: envioId,
        status: estadoFinal,
        confirmado: estadoFinal === 'COMPRADA' || estadoFinal === 'GERADA',
      }
    }

    if (order.melhorEnvioStatus === 'COMPRA_INCERTA' && !opcoes.confirmarNovaTentativa) {
      await liberarLease(order.id, lease)
      return { melhorEnvioId: envioId, status: 'COMPRA_INCERTA', confirmado: false }
    }

    try {
      await comprarEtiquetasME(ids)
    } catch (error) {
      if (resultadoCompraPodeSerIncerto(error)) {
        const estadoFinal = await concluirLeaseComEstado({
          orderId: order.id,
          lease,
          estado: 'COMPRA_INCERTA',
          descricao: 'O Melhor Envio não confirmou a compra da etiqueta. Nenhuma nova cobrança será tentada automaticamente.',
        })
        if (estadoFinal === 'COMPRADA' || estadoFinal === 'GERADA') {
          return { melhorEnvioId: envioId, status: estadoFinal, confirmado: true }
        }
        throw new Error(
          'Não foi possível confirmar se a etiqueta foi cobrada. Use “Verificar compra”; ' +
          'o sistema não fará outra cobrança automaticamente.',
        )
      }
      throw error
    }

    const estadoFinal = await concluirLeaseComEstado({
      orderId: order.id,
      lease,
      estado: 'COMPRADA',
      descricao: 'Etiqueta comprada no Melhor Envio. Aguardando geração.',
    })
    return {
      melhorEnvioId: envioId,
      status: estadoFinal,
      confirmado: estadoFinal === 'COMPRADA' || estadoFinal === 'GERADA',
    }
  } catch (error) {
    await liberarLease(order.id, lease)
    throw error
  }
}

/** Gera, espera e recupera a impressão. Esta função nunca compra nem debita. */
export async function gerarEtiquetaDoPedido(orderId: string): Promise<{
  melhorEnvioId: string
  etiquetaUrl: string
  rastreio: string | null
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      melhorEnvioId: true,
      melhorEnvioStatus: true,
      trackingCode: true,
      nfeChave: true,
    },
  })
  if (!order) throw new Error('Pedido não encontrado')
  if (!order.melhorEnvioId) throw new Error('Pedido não está no carrinho do Melhor Envio')
  if (!['COMPRADA', 'GERADA'].includes(order.melhorEnvioStatus ?? '')) {
    throw new Error('A compra da etiqueta ainda não foi confirmada')
  }
  exigirChaveNfe(order.nfeChave)
  exigirInscricaoEstadual(process.env.LOJA_INSCRICAO_ESTADUAL)

  const lease = await adquirirLease(order.id, 'ETIQUETA', true)
  if (!lease) throw new Error('Geração de etiqueta já está em andamento. Aguarde alguns instantes.')

  const envioId = order.melhorEnvioId
  const ids = [envioId]
  try {
    const remoto = analisarEstadoEnvioRemoto(await consultarEnvioME(envioId))
    if (remoto.cancelada) {
      await concluirLeaseComEstado({
        orderId: order.id,
        lease,
        estado: 'CANCELADA',
        descricao: 'Cancelamento da etiqueta confirmado no Melhor Envio.',
      })
      throw new Error('A etiqueta foi cancelada no Melhor Envio')
    }
    if (!remoto.comprada) throw new Error('O Melhor Envio ainda não confirmou a compra da etiqueta')

    const impressao = await gerarEObterImpressao({
      tentarImpressaoInicial: remoto.gerada || order.melhorEnvioStatus === 'GERADA',
      gerar: () => gerarEtiquetasME(ids),
      imprimir: () => imprimirEtiquetasME(ids),
    })

    let rastreio: string | null = null
    try {
      const tracking = await rastrearEtiquetasME(ids)
      const dados = tracking?.[envioId]
      rastreio = dados?.tracking ?? dados?.melhorenvio_tracking ?? null
    } catch (error) {
      console.error('[envio-me] rastreio ainda indisponível:', error)
    }

    const estadoFinal = await concluirLeaseComEstado({
      orderId: order.id,
      lease,
      estado: 'GERADA',
      etiquetaUrl: impressao.url,
      rastreio,
      marcarSeparando: true,
      descricao:
        'Etiqueta gerada no Melhor Envio. Pedido liberado para separação.' +
        (rastreio ? ` Rastreio: ${rastreio}.` : ' Rastreio ainda não disponível.'),
    })
    if (estadoFinal === 'CANCELADA') throw new Error('A etiqueta foi cancelada no Melhor Envio')
    return { melhorEnvioId: envioId, etiquetaUrl: impressao.url, rastreio }
  } catch (error) {
    await liberarLease(order.id, lease)
    throw error
  }
}
