import { tinyFetch } from './client'
import { prisma } from '../prisma'

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
export async function replicarPedidoOlist(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, user: true },
  })

  if (!order) throw new Error('Pedido não encontrado')

  const endereco = (order.enderecoEntrega ?? {}) as any

  // CPF/CNPJ: prioriza o cadastro do usuário, cai pro endereço (pedido de convidado)
  const cpfCnpj = soDigitos(order.user?.cpf ?? endereco.cpf)
  if (!cpfCnpj) {
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
    obs: `Pedido e-commerce Forza Motos #${order.orderNumber}`,
  }

  // Tiny v2: form-encoded, parâmetro "pedido" com JSON dentro
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

  await prisma.order.update({
    where: { id: orderId },
    data: { olistOrderId: String(tinyPedidoId) },
  })

  return result
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
  const pendentes = await prisma.order.findMany({
    where: { status: 'CONFIRMADO', olistOrderId: null },
    select: { id: true, orderNumber: true },
    orderBy: { createdAt: 'asc' },
    take: limite,
  })

  let replicados = 0
  let falhas = 0

  for (const pedido of pendentes) {
    try {
      await replicarPedidoOlist(pedido.id)
      replicados++
    } catch (e: any) {
      falhas++
      await prisma.orderTracking.create({
        data: {
          orderId: pedido.id,
          status: 'CONFIRMADO',
          descricao: `⚠️ Retry de replicação no Olist falhou: ${String(e?.message).slice(0, 200)}`,
        },
      }).catch(() => {})
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
