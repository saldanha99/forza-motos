import { prisma } from '@/lib/prisma'
import { gerarOrderNumber } from '@/lib/utils'
import { autorizarCupomCheckout } from '@/lib/checkout/cupom'
import { cotarFrete } from '@/lib/frete/cotar'
import {
  chaveIdempotenciaMP,
  criarPreferencia,
  ErroPreferenciaPagamento,
  montarPayer,
  obterPreferencia,
  reconciliarPreferencia,
} from '@/lib/mercadopago'
import { verificarEstoqueTiny } from '@/lib/tiny/verificar-estoque'
import { capturarLead } from '@/lib/crm/leads'
import { calcularExpiracaoReserva, cancelarPedidoComCompensacao, reservarEstoque } from '@/lib/checkout/reserva'
import { normalizarEnderecoCheckout } from '@/lib/checkout/entrada'
import {
  normalizarItensCarrinho,
  precificarItensNoServidor,
  selecionarFreteDoServidor,
} from '@/lib/checkout/calculo'
import { classificarCarrinhoEventoPirelli } from '@/lib/checkout/catalogo-evento-pirelli'
import { atingiuValorMinimoPneus, subtotalPneusDoPedido } from '@/lib/checkout/beneficios-evento-pirelli'
import {
  limparNomeGravacao,
  nomeGravacaoValido,
  normalizarWhatsappEvento,
  novoCodigoQr,
} from '@/lib/evento-pirelli'
import {
  calcularDescontoAvista,
  normalizarMeioPagamentoCheckout,
} from '@/lib/checkout/desconto-avista'

type ItemEntrada = { productId: string; quantidade: unknown }
type Body = {
  items: ItemEntrada[]
  enderecoEntrega: any
  cpf?: string
  freteServico?: string
  cupomCodigo?: string
  meioPagamento?: unknown
  checkoutTentativaId?: string
  eventoPirelliNomeGravacao?: string
}
type Deps = {
  cotar?: typeof cotarFrete
  preferencia?: typeof criarPreferencia
  obterPreferencia?: typeof obterPreferencia
  reconciliarPreferencia?: typeof reconciliarPreferencia
  verificarEstoque?: typeof verificarEstoqueTiny
}

export class PedidoPagamentoIncertoError extends Error {
  constructor(
    readonly pedido: { id: string; orderNumber: string },
  ) {
    super('PAGAMENTO_RESULTADO_INCERTO')
    this.name = 'PedidoPagamentoIncertoError'
  }
}

async function retomarTentativa(
  checkoutTentativaId: string,
  session: any,
  deps: Deps,
  eventoPirelliNomeGravacao: unknown,
) {
  const pedido = await prisma.order.findUnique({ where: { checkoutTentativaId } })
  if (!pedido) return null
  if (pedido.userId && pedido.userId !== session?.user?.id) throw new Error('TENTATIVA_INVALIDA')
  if (pedido.status !== 'AGUARDANDO_PAGAMENTO') throw new Error('TENTATIVA_ENCERRADA')

  if (pedido.eventoPirelliId) {
    const endereco = pedido.enderecoEntrega && typeof pedido.enderecoEntrega === 'object' && !Array.isArray(pedido.enderecoEntrega)
      ? pedido.enderecoEntrega as Record<string, unknown>
      : {}
    const nomePersistido = String(endereco.nomeGravacaoEventoPirelli ?? '')
    const nomeRecebido = typeof eventoPirelliNomeGravacao === 'string'
      ? limparNomeGravacao(eventoPirelliNomeGravacao)
      : ''
    if (nomePersistido !== nomeRecebido) throw new Error('TENTATIVA_INVALIDA')
  }

  // Uma tentativa persistida pode já ter alcançado o MP. Quando o ID foi salvo,
  // consultá-lo diretamente evita depender da indexação eventual da busca por
  // external_reference. Retomadas nunca repetem cegamente o POST.
  let pref = pedido.pagamentoIdExterno
    ? await (deps.obterPreferencia ?? obterPreferencia)(pedido.pagamentoIdExterno).catch(() => null)
    : null
  pref ??= await (deps.reconciliarPreferencia ?? reconciliarPreferencia)(pedido.id).catch(() => null)
  if (!pref) throw new PedidoPagamentoIncertoError(pedido)
  await prisma.order.update({
    where: { id: pedido.id },
    data: {
      pagamentoIdExterno: pref.id,
      pagamentoMetodo: 'mercadopago',
      pagamentoResultadoIncerto: false,
    },
  })
  return { pedido, init_point: pref.init_point }
}

export async function criarPedidoSeguro(body: Body, session: any, deps: Deps = {}) {
  if (!body || typeof body !== 'object') throw new Error('CARRINHO_VAZIO')
  const checkoutTentativaId = body.checkoutTentativaId ? String(body.checkoutTentativaId) : undefined
  if (!checkoutTentativaId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutTentativaId)) {
    throw new Error('TENTATIVA_INVALIDA')
  }
  const retomado = await retomarTentativa(
    checkoutTentativaId,
    session,
    deps,
    body.eventoPirelliNomeGravacao,
  )
  if (retomado) return retomado
  const meioPagamento = normalizarMeioPagamentoCheckout(body.meioPagamento)
  const entradas = normalizarItensCarrinho(body.items)
  const ids = entradas.map((item) => item.productId)
  const produtos = await prisma.product.findMany({
    where: { id: { in: ids }, ativo: true, ocultoManual: false },
    select: {
      id: true,
      nome: true,
      preco: true,
      precoPromocional: true,
      estoque: true,
      preVenda: true,
      prazoEntregaDias: true,
      sku: true,
      categoria: true,
      eventoPirelliId: true,
      limitePorPedidoEvento: true,
      eventoPirelli: {
        select: {
          id: true,
          titulo: true,
          ativo: true,
          publicado: true,
          vendasAntecipadasAbertas: true,
          dataInicio: true,
          dataFim: true,
          valorMinimoPneus: true,
          operadorValorMinimoPneus: true,
          limiteNomeGravacao: true,
        },
      },
    },
  })
  const { items, subtotal } = precificarItensNoServidor(entradas, produtos)
  const campanhaInicial = classificarCarrinhoEventoPirelli(items)
  const elegivelCanecaInicial = Boolean(campanhaInicial && atingiuValorMinimoPneus(
    subtotalPneusDoPedido(items.map((item) => ({
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario,
      product: { sku: item.produto.sku, categoria: item.produto.categoria },
    }))),
    String(campanhaInicial?.evento.valorMinimoPneus ?? 0),
    campanhaInicial?.evento.operadorValorMinimoPneus ?? 'MAIOR_QUE',
  ))
  const nomeGravacaoEvento = typeof body.eventoPirelliNomeGravacao === 'string'
    ? limparNomeGravacao(body.eventoPirelliNomeGravacao)
    : ''
  if (elegivelCanecaInicial && (
    nomeGravacaoEvento.length < 2
    || nomeGravacaoEvento.length > (campanhaInicial?.evento.limiteNomeGravacao ?? 20)
    || !nomeGravacaoValido(nomeGravacaoEvento)
  )) throw new Error('NOME_GRAVACAO_EVENTO_INVALIDO')
  if (campanhaInicial && body.cupomCodigo && String(body.cupomCodigo).trim()) {
    throw new Error('CUPOM_EVENTO_NAO_PERMITIDO')
  }
  const verificacao = await (deps.verificarEstoque ?? verificarEstoqueTiny)(items.filter(i => !i.produto.preVenda).map(i => ({ productId: i.productId, quantidade: i.quantidade })))
  if (!verificacao.ok) throw new Error('ESTOQUE_INSUFICIENTE')
  const endereco = normalizarEnderecoCheckout(body.enderecoEntrega, body.cpf)
  const cpf = endereco.cpf
  const cep = endereco.cep
  if (body.cupomCodigo && String(body.cupomCodigo).length > 60) throw new Error('CUPOM:cupom inválido.')
  if (!body.freteServico || String(body.freteServico).length > 100) throw new Error('FRETE_INVALIDO')
  // O cotador recebe só identidade/quantidade; ele busca preços e dimensões
  // novamente no banco antes de aplicar seguro e frete grátis.
  const entradaFrete = {
    cepDestino: cep,
    items: items.map(i => ({ productId: i.productId, quantidade: i.quantidade })),
  }
  const opcoes = await (deps.cotar ?? cotarFrete)(entradaFrete)
  const frete = selecionarFreteDoServidor(opcoes, body.freteServico)
  // Lead é útil, mas não pode impedir/alterar uma compra válida. Comprar não é
  // opt-in de marketing: registra o contato para o transacional, sem boas-vindas.
  const whatsappEvento = campanhaInicial
    ? normalizarWhatsappEvento(String(endereco.telefone ?? ''))
    : null
  if (campanhaInicial && (!whatsappEvento || whatsappEvento.length < 12 || whatsappEvento.length > 13)) {
    throw new Error('WHATSAPP_EVENTO_PIRELLI_OBRIGATORIO')
  }
  const leadCheckout = endereco?.nome && endereco?.telefone
    ? await capturarLead({ nome: String(endereco.nome), whatsapp: String(endereco.telefone), origem: 'CHECKOUT', enfileirarBoasVindas: false })
      .then(async ({ lead }) => {
        // Marcar a caixa do checkout é uma nova autorização explícita para os
        // avisos deste pedido; ela também desfaz uma supressão antiga.
        if (endereco.whatsappTransacionalAutorizado === true) {
          await prisma.crmLead.update({
            where: { id: lead.id },
            data: { whatsappOptOutEm: null },
          })
        }
        return lead
      })
      .catch(e => { console.error('[checkout] lead:', e); return null })
    : null
  const ano = new Date().getFullYear()
  let criado: { pedido: any; desconto: number; total: number }
  try {
    criado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`checkout:${ano}`}, 0))`
      // Revalida a campanha dentro da transação. Assim, despublicar/encerrar o
      // evento enquanto o cliente cotava o frete impede a criação de um pedido
      // novo, sem manter a transação aberta durante chamadas externas.
      const produtosAtuais = await tx.product.findMany({
        where: { id: { in: ids }, ativo: true, ocultoManual: false },
        select: {
          id: true,
          preco: true,
          precoPromocional: true,
          preVenda: true,
          prazoEntregaDias: true,
          sku: true,
          categoria: true,
          eventoPirelliId: true,
          limitePorPedidoEvento: true,
          eventoPirelli: {
            select: {
              id: true,
              titulo: true,
              ativo: true,
              publicado: true,
              vendasAntecipadasAbertas: true,
              dataInicio: true,
              dataFim: true,
              valorMinimoPneus: true,
              operadorValorMinimoPneus: true,
              limiteNomeGravacao: true,
            },
          },
        },
      })
      if (produtosAtuais.length !== entradas.length) throw new Error('PRODUTO_INVALIDO')
      const produtosAtuaisPorId = new Map(produtosAtuais.map((produto) => [produto.id, produto]))
      const itensAtuais = entradas.map((item) => {
        const produto = produtosAtuaisPorId.get(item.productId)
        if (!produto) throw new Error('PRODUTO_INVALIDO')
        return { ...item, produto }
      })
      const campanhaAtual = classificarCarrinhoEventoPirelli(itensAtuais)
      if ((campanhaAtual?.eventoId ?? null) !== (campanhaInicial?.eventoId ?? null)) {
        throw new Error('CARRINHO_EVENTO_ATUALIZADO')
      }
      const visitanteAtual = campanhaAtual && whatsappEvento
        ? await tx.eventoPirelliVisitante.upsert({
            where: {
              eventoId_whatsapp: {
                eventoId: campanhaAtual.eventoId,
                whatsapp: whatsappEvento,
              },
            },
            create: {
              eventoId: campanhaAtual.eventoId,
              nomeCompleto: String(endereco.nome),
              whatsapp: whatsappEvento,
              email: String(endereco.email || '').trim().toLocaleLowerCase('pt-BR') || null,
              enderecoCep: endereco.cep,
              enderecoRua: endereco.rua,
              enderecoNumero: endereco.numero,
              enderecoComplemento: endereco.complemento || null,
              enderecoBairro: endereco.bairro || null,
              enderecoCidade: endereco.cidade || null,
              enderecoEstado: endereco.estado || null,
              chaveSubmissao: `checkout:${checkoutTentativaId}`,
              codigoQr: novoCodigoQr(),
              crmLeadId: leadCheckout?.id ?? null,
            },
            update: {
              nomeCompleto: String(endereco.nome),
              email: String(endereco.email || '').trim().toLocaleLowerCase('pt-BR') || null,
              enderecoCep: endereco.cep,
              enderecoRua: endereco.rua,
              enderecoNumero: endereco.numero,
              enderecoComplemento: endereco.complemento || null,
              enderecoBairro: endereco.bairro || null,
              enderecoCidade: endereco.cidade || null,
              enderecoEstado: endereco.estado || null,
              ...(leadCheckout?.id ? { crmLeadId: leadCheckout.id } : {}),
            },
            select: { id: true, eventoId: true },
          })
        : null
      if (campanhaAtual && !visitanteAtual) throw new Error('WHATSAPP_EVENTO_PIRELLI_OBRIGATORIO')
      const elegivelCanecaAtual = Boolean(campanhaAtual && atingiuValorMinimoPneus(
        subtotalPneusDoPedido(itensAtuais.map((item) => ({
          quantidade: item.quantidade,
          precoUnitario: Number(item.produto.precoPromocional ?? item.produto.preco),
          product: { sku: item.produto.sku, categoria: item.produto.categoria },
        }))),
        String(campanhaAtual?.evento.valorMinimoPneus ?? 0),
        campanhaAtual?.evento.operadorValorMinimoPneus ?? 'MAIOR_QUE',
      ))
      if (elegivelCanecaAtual !== elegivelCanecaInicial) throw new Error('CARRINHO_EVENTO_ATUALIZADO')
      if (elegivelCanecaAtual && (
        nomeGravacaoEvento.length < 2
        || nomeGravacaoEvento.length > (campanhaAtual?.evento.limiteNomeGravacao ?? 20)
        || !nomeGravacaoValido(nomeGravacaoEvento)
      )) throw new Error('NOME_GRAVACAO_EVENTO_INVALIDO')
      // Preço, promoção e campanha podem ser editados enquanto o cliente
      // preenche endereço/cota frete. Nunca persiste o valor da leitura antiga:
      // exige uma nova cotação e uma confirmação explícita do cliente.
      for (const item of items) {
        const produtoAtual = produtosAtuaisPorId.get(item.productId)
        const precoAtual = Number(produtoAtual?.precoPromocional ?? produtoAtual?.preco)
        if (
          !Number.isFinite(precoAtual) || precoAtual <= 0 ||
          Math.round(precoAtual * 100) !== Math.round(item.precoUnitario * 100)
        ) {
          throw new Error('CARRINHO_PRECO_ATUALIZADO')
        }
      }
      const cupom = body.cupomCodigo
        ? await autorizarCupomCheckout(tx, body.cupomCodigo, subtotal)
        : null
      const descontoCupom = Number(cupom?.desconto ?? 0)
      const descontoAvista = calcularDescontoAvista(subtotal, descontoCupom, meioPagamento)
      const desconto = Number((descontoCupom + descontoAvista).toFixed(2))
      const total = Number(Math.max(0, subtotal + frete.preco - desconto).toFixed(2))
      // Reserva = incremento em Product.estoqueReservado, guardado contra o
      // saldo físico na mesma instrução. Não decrementa Product.estoque, que é
      // o espelho do Tiny: assim o sync não repõe uma unidade já reservada.
      for (const item of itensAtuais.filter(i => !i.produto.preVenda)) {
        const reservado = await reservarEstoque(tx, item.productId, item.quantidade)
        if (!reservado) throw new Error('ESTOQUE_INSUFICIENTE')
      }
      const count = await tx.order.count({ where: { createdAt: { gte: new Date(`${ano}-01-01`) } } })
      const pedido = await tx.order.create({ data: {
        orderNumber: gerarOrderNumber(count + 1, ano), userId: session?.user?.id, subtotal, frete: frete.preco, desconto, cupomCodigo: cupom?.codigo, cupomConsumido: Boolean(cupom), total,
        meioPagamentoCheckout: meioPagamento,
        checkoutTentativaId, pagamentoResultadoIncerto: true, reservaExpiraEm: calcularExpiracaoReserva(),
        canal: campanhaAtual ? 'EVENTO_PIRELLI' : 'ECOMMERCE',
        eventoPirelliId: campanhaAtual?.eventoId,
        eventoPirelliVisitanteId: visitanteAtual?.id,
        enderecoEntrega: elegivelCanecaAtual ? { ...endereco, nomeGravacaoEventoPirelli: nomeGravacaoEvento } : endereco, freteServico: frete.id, freteTransportadora: frete.transportadora, fretePrazo: frete.prazo, status: 'AGUARDANDO_PAGAMENTO',
        items: { create: items.map(i => {
          const produtoAtual = produtosAtuaisPorId.get(i.productId)
          if (!produtoAtual) throw new Error('PRODUTO_INVALIDO')
          return {
            productId: i.productId,
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario,
            estoqueReservado: !produtoAtual.preVenda,
            preVendaSnapshot: produtoAtual.preVenda,
            prazoEntregaDiasSnapshot: produtoAtual.preVenda ? produtoAtual.prazoEntregaDias : null,
          }
        }) },
        tracking: { create: {
          status: 'AGUARDANDO_PAGAMENTO',
          descricao: campanhaAtual
            ? 'Pedido da pré-venda Pirelli criado — aguardando pagamento.'
            : 'Pedido criado — aguardando pagamento.',
        } },
      }, include: { items: { include: { product: true } } } })
      return { pedido, desconto, total }
    })
  } catch (error: any) {
    if (checkoutTentativaId && error?.code === 'P2002') {
      const retomado = await retomarTentativa(
        checkoutTentativaId,
        session,
        deps,
        body.eventoPirelliNomeGravacao,
      )
      if (retomado) return retomado
    }
    throw error
  }
  const { pedido, desconto, total } = criado
  const valorItensMP = Number((subtotal - desconto).toFixed(2))
  if (valorItensMP <= 0 || Number((valorItensMP + frete.preco).toFixed(2)) !== total) {
    await cancelarPedidoComCompensacao(pedido.id, 'Total inválido antes de contatar o gateway. Reservas devolvidas.')
    throw new Error('PAGAMENTO_INDISPONIVEL')
  }
  let pref: Awaited<ReturnType<typeof criarPreferencia>>
  try {
    const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
    const tokenRetorno = encodeURIComponent(checkoutTentativaId)
    pref = await (deps.preferencia ?? criarPreferencia)({
      // O MP não aceita linha negativa: um item agregado carrega o desconto já aplicado.
      items: [{ id: pedido.id, title: `Pedido ${pedido.orderNumber}`, quantity: 1, unit_price: valorItensMP }],
      payer: montarPayer({ email: session?.user?.email ?? endereco?.email, nome: endereco?.nome ?? session?.user?.name, telefone: endereco?.telefone, cpf, cep, rua: endereco?.rua, numero: endereco?.numero }),
      external_reference: pedido.id,
      freteCusto: frete.preco,
      meioPagamentoCheckout: meioPagamento,
      // O navegador recebe apenas o token opaco da tentativa; o ID interno
      // continua restrito à correlação servidor↔Mercado Pago.
      back_urls: {
        success: `${baseUrl}/checkout/sucesso?token=${tokenRetorno}`,
        failure: `${baseUrl}/checkout/erro?token=${tokenRetorno}`,
        pending: `${baseUrl}/checkout/pendente?token=${tokenRetorno}`,
      },
      idempotencyKey: chaveIdempotenciaMP(`pedido:${pedido.id}`),
      expirationDateTo: pedido.reservaExpiraEm ?? calcularExpiracaoReserva(),
    })
  } catch (error) {
    if (error instanceof ErroPreferenciaPagamento && !error.resultadoIncerto) {
      await cancelarPedidoComCompensacao(pedido.id, 'Preferência de pagamento rejeitada pelo gateway. Reservas devolvidas.')
      throw new Error('PAGAMENTO_INDISPONIVEL')
    }
    await prisma.orderTracking.create({
      data: {
        orderId: pedido.id,
        status: 'AGUARDANDO_PAGAMENTO',
        descricao: 'Resultado da criação da preferência incerto. Aguardando reconciliação pelo Mercado Pago; reservas mantidas.',
      },
    }).catch(() => {})
    throw new PedidoPagamentoIncertoError(pedido)
  }
  // Daqui em diante a preferência existe: nunca cancele/devolva estoque por falha local.
  await prisma.order.update({ where: { id: pedido.id }, data: { pagamentoIdExterno: pref.id, pagamentoMetodo: 'mercadopago', pagamentoResultadoIncerto: false } }).catch(error => console.error('[checkout] preferência criada, persistência pendente:', error))
  // CPF é dado cadastral; métricas de venda só avançam quando o webhook
  // confirma o primeiro pagamento aprovado.
  if (session?.user?.id) {
    await prisma.user.update({ where: { id: session.user.id }, data: { cpf } }).catch(() => {})
  }
  return { pedido, init_point: pref.init_point }
}
