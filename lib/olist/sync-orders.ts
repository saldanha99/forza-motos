import { tinyFetch } from './client'
import { prisma } from '../prisma'
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'

/** Remove tudo que não for dígito (CPF/CNPJ, CEP, telefone) */
function soDigitos(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '')
}

/** Data no formato dd/mm/yyyy exigido pela API Tiny v2 */
function dataTiny(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Replica um pedido pago no Olist/Tiny via API v2 (`pedido.incluir.php`).
 *
 * IMPORTANTE: a API Tiny v2 espera o payload em PORTUGUÊS, com a estrutura
 * { pedido: { cliente: {...}, itens: [{ item: {...} }], ... } }.
 * O `cpf_cnpj` do cliente é OBRIGATÓRIO para o Olist emitir NF-e.
 *
 * Ao incluir o pedido, o Olist dá baixa no estoque do depósito → é assim
 * que a venda do e-commerce reflete no ERP (e volta pro site no sync de entrada).
 */
export class PedidoOlistIncertoError extends Error {
  readonly requerConfirmacao = true

  constructor() {
    super(
      'O Olist ainda não confirmou se recebeu este pedido. A busca de segurança não encontrou a venda; ' +
      'aguarde a indexação ou confirme manualmente uma nova inclusão após conferir o painel do Olist.',
    )
    this.name = 'PedidoOlistIncertoError'
  }
}

export async function replicarPedidoOlist(
  orderId: string,
  opcoes: { confirmarNovaInclusao?: boolean } = {},
) {
  const agora = new Date()
  const lease = `PROCESSANDO:${randomUUID()}`
  const leaseExpiraEm = new Date(agora.getTime() + 5 * 60 * 1000)

  // Claim atômico: estados em que sabemos que nenhuma inclusão externa ficou
  // sem resposta podem seguir normalmente.
  let origemIncerta = false
  let claim = await prisma.order.updateMany({
    where: {
      id: orderId,
      olistOrderId: null,
      status: { in: ['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE'] },
      OR: [
        { olistSyncStatus: null },
        { olistSyncStatus: 'FALHOU' },
      ],
    },
    data: {
      olistSyncStatus: lease,
      olistSyncExpiraEm: leaseExpiraEm,
    },
  })

  if (claim.count === 0) {
    // Uma resposta perdida ou um lease vencido pode significar que o Tiny já
    // criou a venda. Este caminho sempre pesquisa primeiro e nunca reinsere
    // automaticamente, mesmo após o prazo do lease.
    claim = await prisma.order.updateMany({
      where: {
        id: orderId,
        olistOrderId: null,
        status: { in: ['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE'] },
        OR: [
          { olistSyncStatus: 'INCERTO' },
          {
            olistSyncStatus: { startsWith: 'PROCESSANDO:' },
            olistSyncExpiraEm: { lt: agora },
          },
        ],
      },
      data: {
        olistSyncStatus: lease,
        olistSyncExpiraEm: leaseExpiraEm,
      },
    })
    origemIncerta = claim.count === 1
  }

  if (claim.count === 0) {
    const atual = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, olistOrderId: true, olistSyncStatus: true },
    })
    if (!atual) throw new Error('Pedido não encontrado')
    if (atual.olistOrderId) {
      return { idempotente: true, olistOrderId: atual.olistOrderId }
    }
    if (atual.olistSyncStatus?.startsWith('PROCESSANDO:')) {
      return { idempotente: true, processando: true }
    }
    throw new Error(`Pedido ${orderId} não está pago e não pode ser enviado ao Olist`)
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, user: true },
  })

  if (!order) {
    await prisma.order.updateMany({
      where: { id: orderId, olistSyncStatus: lease },
      data: {
        olistSyncStatus: origemIncerta ? 'INCERTO' : 'FALHOU',
        olistSyncExpiraEm: null,
      },
    })
    throw new Error('Pedido não encontrado')
  }

  const endereco = (order.enderecoEntrega ?? {}) as any

  // O Tiny não aceita uma chave de idempotência no pedido.incluir.php. Antes
  // de qualquer inclusão/retry, pesquisamos pela referência única do nosso
  // e-commerce. Assim, uma resposta perdida não duplica venda nem estoque.
  try {
    const existente = await buscarPedidoOlistPorNumeroEcommerce(order.orderNumber)
    if (existente) {
      const recuperou = await prisma.order.updateMany({
        where: { id: order.id, olistSyncStatus: lease },
        data: {
          olistOrderId: existente,
          olistSyncStatus: 'CONCLUIDO',
          olistSyncExpiraEm: null,
        },
      })
      if (!recuperou.count) throw new Error('Lease do Olist expirou durante a reconciliação')
      return { idempotente: true, recuperado: true, olistOrderId: existente }
    }

    if (origemIncerta && !opcoes.confirmarNovaInclusao) {
      await prisma.order.updateMany({
        where: { id: order.id, olistSyncStatus: lease },
        data: { olistSyncStatus: 'INCERTO', olistSyncExpiraEm: null },
      })
      throw new PedidoOlistIncertoError()
    }
  } catch (error) {
    await prisma.order.updateMany({
      where: { id: order.id, olistSyncStatus: lease },
      data: { olistSyncStatus: 'INCERTO', olistSyncExpiraEm: null },
    }).catch(() => {})
    throw error
  }

  // CPF/CNPJ: prioriza o cadastro do usuário, cai pro endereço (pedido de convidado)
  const cpfCnpj = soDigitos(order.user?.cpf ?? endereco.cpf)
  if (!cpfCnpj) {
    await prisma.order.updateMany({
      where: { id: orderId, olistSyncStatus: lease },
      data: {
        olistSyncStatus: origemIncerta ? 'INCERTO' : 'FALHOU',
        olistSyncExpiraEm: null,
      },
    })
    throw new Error(
      'CPF/CNPJ ausente — Olist exige documento do cliente para emitir NF. ' +
      'Pedido ' + order.orderNumber,
    )
  }
  const tipoPessoa = cpfCnpj.length > 11 ? 'J' : 'F'

  const nomeCliente = order.user?.nome ?? endereco.nome ?? 'Cliente'
  const emailCliente = order.user?.email ?? endereco.email ?? ''
  const foneCliente = soDigitos(order.user?.telefone ?? endereco.telefone)

  // Estrutura exigida pela API Tiny v2 (campos em português)
  const pedido: Record<string, any> = {
    data_pedido: dataTiny(order.createdAt ?? new Date()),
    // Referência do nosso e-commerce — facilita conciliação no painel Olist
    numero_pedido_ecommerce: order.orderNumber,
    cliente: {
      nome: nomeCliente,
      tipo_pessoa: tipoPessoa,
      cpf_cnpj: cpfCnpj,
      endereco: endereco.rua ?? '',
      numero: endereco.numero ?? '',
      complemento: endereco.complemento ?? '',
      bairro: endereco.bairro ?? '',
      cep: soDigitos(endereco.cep),
      cidade: endereco.cidade ?? '',
      uf: (endereco.estado ?? '').toUpperCase().slice(0, 2),
      fone: foneCliente,
      email: emailCliente,
      // Atualiza/cria o cadastro do cliente no Tiny a partir destes dados
      atualizar_cliente: 'S',
    },
    itens: order.items.map((item) => ({
      item: {
        codigo: item.product.sku,
        descricao: item.product.nome,
        unidade: 'UN',
        quantidade: item.quantidade,
        valor_unitario: Number(item.precoUnitario),
      },
    })),
    // Frete: nome da transportadora escolhida + valor cobrado do cliente
    ...(order.freteTransportadora && { nome_transportador: order.freteTransportadora }),
    valor_frete: Number(order.frete),
    valor_desconto: Number(order.desconto),
    obs: `Pedido e-commerce Forza Motos #${order.orderNumber}`,
  }

  // Tiny v2: form-encoded, parâmetro "pedido" com JSON dentro
  try {
    const result = await tinyFetch('pedido.incluir.php', {
      pedido: JSON.stringify({ pedido }),
    })

    // A resposta do Tiny v2 pode vir como objeto OU array em "registros"
    const tinyPedidoId = extrairIdPedido(result)

    if (!tinyPedidoId) {
      // Erros por registro ficam dentro de registros[].registro.erros
      const msg = extrairErroRegistro(result) || 'Olist não retornou o ID do pedido'
      throw new Error(`Falha ao incluir pedido no Olist: ${msg}`)
    }

    const persistiu = await prisma.order.updateMany({
      where: { id: orderId, olistSyncStatus: lease },
      data: {
        olistOrderId: String(tinyPedidoId),
        olistSyncStatus: 'CONCLUIDO',
        olistSyncExpiraEm: null,
      },
    })
    if (!persistiu.count) {
      throw new Error('Pedido criado no Olist, mas o lease local expirou antes da confirmação')
    }

    return result
  } catch (error) {
    await prisma.order.updateMany({
      where: { id: orderId, olistSyncStatus: lease },
      // Mesmo um erro de rede pode ocorrer depois que o Tiny criou o pedido.
      // O próximo retry precisa pesquisar primeiro, nunca reenviar às cegas.
      data: { olistSyncStatus: 'INCERTO', olistSyncExpiraEm: null },
    }).catch(() => {})
    throw error
  }
}

async function buscarPedidoOlistPorNumeroEcommerce(orderNumber: string): Promise<string | null> {
  const resposta = await tinyFetch('pedidos.pesquisa.php', {
    numeroEcommerce: orderNumber,
    pagina: 1,
  })
  const brutos = resposta?.retorno?.pedidos ?? []
  const pedidos = Array.isArray(brutos) ? brutos : [brutos]
  const encontrado = pedidos
    .map((entrada: any) => entrada?.pedido ?? entrada)
    .find((pedido: any) => String(pedido?.numero_ecommerce ?? '') === orderNumber)
  return encontrado?.id ? String(encontrado.id) : null
}

/**
 * Reprocessa pedidos já CONFIRMADOS (pagos) que ainda não foram replicados
 * no Olist — rede de segurança para quando o webhook do MP falhou na hora.
 * Rodado pelo cron diário. Limita a `limite` pedidos por execução.
 */
export async function replicarPedidosPendentes(limite = 20): Promise<{
  replicados: number
  falhas: number
  total: number
}> {
  const base: Prisma.OrderWhereInput = {
    olistOrderId: null,
    eventoPirelliId: null,
    canal: { not: 'EVENTO_PIRELLI' },
  }

  // Pedidos novos vêm primeiro: um conjunto antigo de respostas incertas não
  // pode ocupar todo o lote e atrasar vendas recém-pagas.
  const novos = await prisma.order.findMany({
    where: {
      ...base,
      status: 'CONFIRMADO',
      OR: [{ olistSyncStatus: null }, { olistSyncStatus: 'FALHOU' }],
    },
    select: { id: true, orderNumber: true },
    orderBy: { createdAt: 'asc' },
    take: limite,
  })
  const restantes = Math.max(0, limite - novos.length)
  const incertos = restantes === 0 ? [] : await prisma.order.findMany({
    where: {
      ...base,
      status: { in: ['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE'] },
      OR: [
        { olistSyncStatus: 'INCERTO' },
        {
          olistSyncStatus: { startsWith: 'PROCESSANDO:' },
          olistSyncExpiraEm: { lt: new Date() },
        },
      ],
    },
    select: { id: true, orderNumber: true },
    orderBy: { createdAt: 'asc' },
    take: restantes,
  })
  const pendentes = [...novos, ...incertos]

  let replicados = 0
  let falhas = 0

  for (const pedido of pendentes) {
    try {
      await replicarPedidoOlist(pedido.id)
      replicados++
    } catch (e: any) {
      falhas++
      if (!(e instanceof PedidoOlistIncertoError)) {
        await prisma.orderTracking.create({
          data: {
            orderId: pedido.id,
            status: 'CONFIRMADO',
            descricao: `⚠️ Retry de replicação no Olist falhou: ${String(e?.message).slice(0, 200)}`,
          },
        }).catch(() => {})
      }
    }
  }

  return { replicados, falhas, total: pendentes.length }
}

/** Extrai o ID do pedido das múltiplas formas possíveis da resposta Tiny v2 */
function extrairIdPedido(result: any): string | number | null {
  const retorno = result?.retorno
  if (!retorno) return null

  const registros = retorno.registros
  // Forma 1: registros.registro.id (objeto único — comum no Tiny v2)
  if (registros?.registro?.id) return registros.registro.id
  // Forma 2: registros[0].registro.id (array)
  if (Array.isArray(registros) && registros[0]?.registro?.id) return registros[0].registro.id
  // Forma 3: registros[0].id (array simples)
  if (Array.isArray(registros) && registros[0]?.id) return registros[0].id
  // Forma 4: retorno.id direto
  if (retorno.id) return retorno.id
  return null
}

/** Extrai mensagem de erro por registro (quando o status geral é OK mas o item falhou) */
function extrairErroRegistro(result: any): string | null {
  const registros = result?.retorno?.registros
  const reg = registros?.registro ?? (Array.isArray(registros) ? registros[0]?.registro : null)
  const erros = reg?.erros
  if (!erros) return null
  if (Array.isArray(erros)) {
    return erros.map((e: any) => e?.erro ?? e).filter(Boolean).join('; ')
  }
  return erros.erro ?? JSON.stringify(erros)
}
