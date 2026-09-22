/**
 * NF-e Olist autorizada -> remessa no carrinho do Melhor Envio.
 *
 * Esta automação termina obrigatoriamente em CARRINHO. Comprar a etiqueta é
 * uma operação financeira separada e continua restrita ao clique do admin.
 */

import { prisma } from '@/lib/prisma'
import { adicionarPedidoAoCarrinho } from '@/lib/frete/envio-me'
import { exigirChaveNfe, normalizarChaveNfe } from '@/lib/frete/nfe'
import { SERVICOS_CORREIOS_LOJA } from '@/lib/frete/melhor-envio'
import { tinyFetch } from '@/lib/olist/client'
import { agendarNotificacoesEtapaPedido } from '@/lib/checkout/notificacoes-etapas-pedido'
import {
  interpretarNotaFiscalOlist,
  interpretarPedidoOlistFiscal,
  type NotaFiscalOlist,
} from '@/lib/olist/nfe-envio-core'

const STATUS_PREPARAVEIS = ['CONFIRMADO', 'SEPARANDO'] as const
const SERVICOS_AUTOMATICOS = new Set<number>(SERVICOS_CORREIOS_LOJA)

type OrigemRegistro = 'OLIST_AUTOMATICO' | 'ADMIN_MANUAL'

export interface ResultadoPreparacaoAutomatica {
  processado: boolean
  motivo: string
  pedidoId?: string
  orderNumber?: string
  melhorEnvioId?: string | null
  registrouNfe?: boolean
}

export interface ResumoReconciliacaoNfe {
  analisados: number
  preparados: number
  jaPreparados: number
  aguardandoNfe: number
  ignorados: number
  erros: number
}

function servicoAutomatico(freteServico: string | null): boolean {
  return SERVICOS_AUTOMATICOS.has(Number(freteServico))
}

function statusPreparavel(status: string): boolean {
  return (STATUS_PREPARAVEIS as readonly string[]).includes(status)
}

function validarIdentidadeFiscal(chave: string): void {
  // A opção `invoice.key` do Melhor Envio é para NF-e modelo 55, não NFC-e 65.
  if (chave.slice(20, 22) !== '55') {
    throw new Error('O documento fiscal autorizado não é uma NF-e modelo 55')
  }

  const cnpjConfigurado = String(process.env.LOJA_CNPJ ?? '00857031000163').replace(/\D/g, '')
  const cnpjDaChave = chave.slice(6, 20)
  if (cnpjConfigurado && cnpjDaChave !== cnpjConfigurado) {
    throw new Error('O CNPJ emissor da NF-e não corresponde ao CNPJ configurado da loja')
  }
}

/**
 * Núcleo compartilhado pelo webhook, cron e fallback manual do painel.
 * É idempotente para a mesma chave e nunca chama a compra da etiqueta.
 */
export async function registrarNfeEPrepararEnvio(
  orderId: string,
  chaveInformada: unknown,
  origem: OrigemRegistro,
  opcoes: { idNotaFiscal?: string | null } = {},
): Promise<ResultadoPreparacaoAutomatica> {
  const nfeChave = exigirChaveNfe(chaveInformada)
  validarIdentidadeFiscal(nfeChave)

  let pedido = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      freteServico: true,
      nfeChave: true,
      melhorEnvioId: true,
    },
  })
  if (!pedido) throw new Error('Pedido não encontrado')
  if (!statusPreparavel(pedido.status)) {
    throw new Error(`Pedido está ${pedido.status} — não preparar envio`)
  }
  if (!servicoAutomatico(pedido.freteServico)) {
    throw new Error('A preparação automática aceita somente Correios PAC ou SEDEX do Melhor Envio')
  }
  if (pedido.melhorEnvioId && pedido.nfeChave !== nfeChave) {
    throw new Error('O envio já foi criado e sua chave fiscal não pode ser alterada')
  }
  if (pedido.nfeChave && pedido.nfeChave !== nfeChave) {
    throw new Error('A chave da NF-e já registrada não pode ser substituída')
  }

  let registrouNfe = false
  if (!pedido.nfeChave) {
    const pedidoInicial = pedido
    registrouNfe = await prisma.$transaction(async (tx) => {
      const gravou = await tx.order.updateMany({
        where: {
          id: pedidoInicial.id,
          nfeChave: null,
          status: { in: [...STATUS_PREPARAVEIS] },
        },
        data: { nfeChave, nfeRegistradaEm: new Date() },
      })
      if (!gravou.count) return false

      await tx.orderTracking.create({
        data: {
          orderId: pedidoInicial.id,
          status: pedidoInicial.status,
          descricao: origem === 'OLIST_AUTOMATICO'
            ? 'NF-e autorizada na Olist/Tiny e registrada automaticamente. Envio liberado para preparação.'
            : 'Chave da NF-e registrada por administrador. Envio comercial liberado para preparação.',
        },
      })
      return true
    })

    // Outro webhook/cron pode ter vencido a mesma corrida. A mesma chave é
    // sucesso idempotente; chave diferente ou cancelamento continuam bloqueados.
    if (!registrouNfe) {
      pedido = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          freteServico: true,
          nfeChave: true,
          melhorEnvioId: true,
        },
      })
      if (!pedido) throw new Error('Pedido não encontrado')
      if (pedido.nfeChave !== nfeChave) {
        throw new Error('O pedido mudou enquanto a NF-e era registrada')
      }
      if (!statusPreparavel(pedido.status)) {
        throw new Error(`Pedido está ${pedido.status} — não preparar envio`)
      }
    }
  }

  // A obrigação fiscal independe de o Melhor Envio estar disponível. Se a
  // chamada logística falhar logo abaixo, o cliente ainda recebe a NF-e; a
  // reconciliação também repara esta outbox de forma idempotente.
  await agendarNotificacoesEtapaPedido(pedido.id, 'NFE_AUTORIZADA', {
    idNotaFiscal: opcoes.idNotaFiscal,
  }).catch((error) => {
    console.error(
      `[olist-nfe] ${pedido.orderNumber}: notificação fiscal pendente —`,
      error instanceof Error ? error.message : 'falha desconhecida',
    )
  })

  const envio = await adicionarPedidoAoCarrinho(pedido.id)
  return {
    processado: true,
    motivo: envio.motivo ?? (envio.criado ? 'remessa preparada' : 'remessa já preparada'),
    pedidoId: pedido.id,
    orderNumber: pedido.orderNumber,
    melhorEnvioId: envio.melhorEnvioId,
    registrouNfe,
  }
}

async function obterNotaFiscalAutorizada(idNotaFiscal: string): Promise<NotaFiscalOlist | null> {
  const resposta = await tinyFetch('nota.fiscal.obter.php', { id: idNotaFiscal })
  const nota = interpretarNotaFiscalOlist(resposta)
  if (!nota) throw new Error(`Olist não devolveu os dados completos da NF-e ${idNotaFiscal}`)
  if (nota.id !== idNotaFiscal) {
    throw new Error('Olist devolveu uma NF-e diferente da solicitada')
  }
  return nota.autorizada ? nota : null
}

/** Confirma a autorização e todos os vínculos antes de transmitir ao ME. */
export async function processarNotaFiscalOlist(input: {
  idNotaFiscal: string
  chaveRecebida?: string | null
  olistOrderId?: string | null
}): Promise<ResultadoPreparacaoAutomatica> {
  const idNotaFiscal = String(input.idNotaFiscal ?? '').trim()
  if (!idNotaFiscal || idNotaFiscal === '0') {
    return { processado: false, motivo: 'evento sem id de NF-e' }
  }

  const nota = await obterNotaFiscalAutorizada(idNotaFiscal)
  if (!nota) {
    return { processado: false, motivo: 'NF-e ainda não está autorizada' }
  }

  const chaveAutorizada = exigirChaveNfe(nota.chaveAcesso)
  validarIdentidadeFiscal(chaveAutorizada)
  const chaveRecebida = input.chaveRecebida
    ? normalizarChaveNfe(input.chaveRecebida)
    : null
  if (chaveRecebida && chaveRecebida !== chaveAutorizada) {
    throw new Error('A chave recebida no webhook diverge da NF-e consultada na Olist')
  }
  if (input.olistOrderId && String(input.olistOrderId) !== nota.idVenda) {
    throw new Error('A NF-e consultada pertence a outro pedido da Olist')
  }

  const pedidos = await prisma.order.findMany({
    where: { olistOrderId: nota.idVenda },
    take: 2,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      freteServico: true,
      melhorEnvioId: true,
    },
  })
  if (!pedidos.length) {
    return { processado: false, motivo: 'NF-e não pertence a um pedido deste e-commerce' }
  }
  if (pedidos.length !== 1) {
    throw new Error('Mais de um pedido local possui o mesmo identificador da Olist')
  }
  const pedido = pedidos[0]

  if (nota.numeroEcommerce && nota.numeroEcommerce !== pedido.orderNumber) {
    throw new Error('O número do e-commerce na NF-e diverge do pedido local')
  }
  if (nota.valorNota === null) {
    throw new Error('A Olist não informou o valor da NF-e autorizada')
  }
  if (Math.round(nota.valorNota * 100) !== Math.round(Number(pedido.total) * 100)) {
    throw new Error('O valor da NF-e autorizada diverge do total do pedido')
  }
  if (!statusPreparavel(pedido.status)) {
    return {
      processado: false,
      motivo: `pedido em ${pedido.status} — remessa automática não permitida`,
      pedidoId: pedido.id,
      orderNumber: pedido.orderNumber,
    }
  }
  if (!servicoAutomatico(pedido.freteServico)) {
    return {
      processado: false,
      motivo: 'pedido não usa PAC/SEDEX do Melhor Envio',
      pedidoId: pedido.id,
      orderNumber: pedido.orderNumber,
    }
  }

  return registrarNfeEPrepararEnvio(pedido.id, chaveAutorizada, 'OLIST_AUTOMATICO', {
    idNotaFiscal,
  })
}

/**
 * Rede de segurança para aviso perdido ou erro temporário. Executada pelo cron
 * em lote pequeno; uma falha não impede os outros pedidos de convergirem.
 */
export async function reconciliarNfesEEnvios(
  limite = 5,
): Promise<ResumoReconciliacaoNfe> {
  const candidatos = await prisma.order.findMany({
    where: {
      status: { in: [...STATUS_PREPARAVEIS] },
      olistOrderId: { not: null },
      freteServico: { in: SERVICOS_CORREIOS_LOJA.map(String) },
      melhorEnvioId: null,
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.max(1, Math.min(limite, 10)),
    select: {
      id: true,
      orderNumber: true,
      olistOrderId: true,
      nfeChave: true,
    },
  })

  const resumo: ResumoReconciliacaoNfe = {
    analisados: candidatos.length,
    preparados: 0,
    jaPreparados: 0,
    aguardandoNfe: 0,
    ignorados: 0,
    erros: 0,
  }

  for (const pedido of candidatos) {
    try {
      let resultado: ResultadoPreparacaoAutomatica
      if (pedido.nfeChave) {
        resultado = await registrarNfeEPrepararEnvio(
          pedido.id,
          pedido.nfeChave,
          'OLIST_AUTOMATICO',
        )
      } else {
        const respostaPedido = await tinyFetch('pedido.obter.php', {
          id: String(pedido.olistOrderId),
        })
        const pedidoOlist = interpretarPedidoOlistFiscal(respostaPedido)
        if (!pedidoOlist?.idNotaFiscal) {
          resumo.aguardandoNfe += 1
          continue
        }
        if (pedidoOlist.id !== pedido.olistOrderId) {
          throw new Error('Olist devolveu um pedido diferente do solicitado')
        }
        resultado = await processarNotaFiscalOlist({
          idNotaFiscal: pedidoOlist.idNotaFiscal,
          olistOrderId: pedido.olistOrderId,
        })
      }

      if (!resultado.processado) {
        if (/ainda não está autorizada|sem id de NF-e/.test(resultado.motivo)) {
          resumo.aguardandoNfe += 1
        } else {
          resumo.ignorados += 1
        }
      } else if (resultado.motivo === 'já estava no carrinho' ||
        resultado.motivo === 'remessa já preparada') {
        resumo.jaPreparados += 1
      } else {
        resumo.preparados += 1
      }
    } catch (erro) {
      resumo.erros += 1
      console.error(
        `[olist-nfe] ${pedido.orderNumber}: preparo automático pendente —`,
        erro instanceof Error ? erro.message : 'erro desconhecido',
      )
    }
  }

  return resumo
}
