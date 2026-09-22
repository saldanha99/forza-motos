import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { gerarOrderNumber } from '@/lib/utils'
import { cpfValido } from '@/lib/checkout/entrada'
import { limparNomeGravacao, nomeGravacaoValido } from '@/lib/evento-pirelli'
import { calcularExpiracaoReserva, cancelarPedidoComCompensacao } from '@/lib/checkout/reserva'
import {
  chaveIdempotenciaMP,
  criarPreferencia,
  ErroPreferenciaPagamento,
  montarPayer,
  obterPreferencia,
  reconciliarPreferencia,
} from '@/lib/mercadopago'

export const SKU_CANECA_EVENTO_PIRELLI = 'EVENTO-PIRELLI-CANECA-SISTEMA'
export const SLUG_CANECA_EVENTO_PIRELLI = 'evento-pirelli-caneca-personalizada-checkout'
export const LIMITE_CANECA_POR_CHECKOUT = 10

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CODIGO_QR = /^[A-Za-z0-9_-]{20,100}$/

export const checkoutCanecaEventoSchema = z.object({
  codigoQr: z.string().trim().regex(CODIGO_QR, 'QR inválido.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').max(254),
  cpf: z.string().max(20).transform((valor) => valor.replace(/\D/g, ''))
    .refine(cpfValido, 'CPF inválido.'),
  nomeGravacao: z.string().trim().min(2, 'Informe o nome para gravar.').max(100)
    .transform(limparNomeGravacao)
    .refine(nomeGravacaoValido, 'O nome da caneca não pode conter emojis ou símbolos especiais.'),
  quantidade: z.number().int().min(1).max(LIMITE_CANECA_POR_CHECKOUT),
  checkoutTentativaId: z.string().trim().toLowerCase().regex(UUID, 'Tentativa inválida.'),
}).strict()

export type EntradaCheckoutCanecaEvento = z.infer<typeof checkoutCanecaEventoSchema>

type EventoVenda = {
  ativo: boolean
  publicado: boolean
  vendasAntecipadasAbertas: boolean
  dataInicio: Date | null
  dataFim: Date | null
}

export function vendasEventoPirelliAbertas(evento: EventoVenda, agora = new Date()) {
  if (!evento.ativo || !evento.publicado) return false
  if (evento.dataFim && agora > evento.dataFim) return false
  return Boolean(
    evento.vendasAntecipadasAbertas ||
    !evento.dataInicio ||
    agora >= evento.dataInicio,
  )
}

export class CheckoutCanecaEventoError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    readonly retrySafe = false,
  ) {
    super(code)
    this.name = 'CheckoutCanecaEventoError'
  }
}

export class CheckoutCanecaPagamentoIncertoError extends Error {
  constructor(readonly pedido: { id: string; orderNumber: string }) {
    super('PAGAMENTO_RESULTADO_INCERTO')
    this.name = 'CheckoutCanecaPagamentoIncertoError'
  }
}

type DependenciasCheckoutCaneca = {
  preferencia?: typeof criarPreferencia
  reconciliarPreferencia?: typeof reconciliarPreferencia
  obterPreferencia?: typeof obterPreferencia
  agora?: () => Date
}

type PedidoCheckoutCaneca = Prisma.OrderGetPayload<{
  select: {
    id: true
    orderNumber: true
    status: true
    eventoPirelliId: true
    eventoPirelliVisitanteId: true
    pagamentoIdExterno: true
    pagamentoResultadoIncerto: true
    reservaExpiraEm: true
    enderecoEntrega: true
    items: {
      select: {
        quantidade: true
        product: { select: { sku: true } }
      }
    }
  }
}>

function somenteDigitos(valor: unknown) {
  return String(valor ?? '').replace(/\D/g, '')
}

function enderecoComoObjeto(valor: Prisma.JsonValue): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {}
}

function tentativaPertenceAEntrada(
  pedido: PedidoCheckoutCaneca,
  entrada: EntradaCheckoutCanecaEvento,
  visitante: { id: string; eventoId: string },
) {
  const endereco = enderecoComoObjeto(pedido.enderecoEntrega)
  return (
    pedido.eventoPirelliId === visitante.eventoId &&
    pedido.eventoPirelliVisitanteId === visitante.id &&
    String(endereco.email ?? '').trim().toLowerCase() === entrada.email &&
    somenteDigitos(endereco.cpf) === entrada.cpf &&
    String(endereco.nomeGravacao ?? '') === entrada.nomeGravacao &&
    pedido.items.length === 1 &&
    pedido.items[0]?.product.sku === SKU_CANECA_EVENTO_PIRELLI &&
    pedido.items[0]?.quantidade === entrada.quantidade
  )
}

async function localizarPedidoDaTentativa(checkoutTentativaId: string) {
  return prisma.order.findUnique({
    where: { checkoutTentativaId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      eventoPirelliId: true,
      eventoPirelliVisitanteId: true,
      pagamentoIdExterno: true,
      pagamentoResultadoIncerto: true,
      reservaExpiraEm: true,
      enderecoEntrega: true,
      items: {
        select: {
          quantidade: true,
          product: { select: { sku: true } },
        },
      },
    },
  })
}

async function retomarTentativaCaneca(
  entrada: EntradaCheckoutCanecaEvento,
  visitante: { id: string; eventoId: string },
  deps: DependenciasCheckoutCaneca,
) {
  const pedido = await localizarPedidoDaTentativa(entrada.checkoutTentativaId)
  if (!pedido) return null
  if (!tentativaPertenceAEntrada(pedido, entrada, visitante)) {
    throw new CheckoutCanecaEventoError('TENTATIVA_CONFLITANTE', 409)
  }
  if (pedido.status !== 'AGUARDANDO_PAGAMENTO') {
    throw new CheckoutCanecaEventoError('TENTATIVA_ENCERRADA', 409, true)
  }

  // Depois que o pedido local existe, um retry nunca repete cegamente o POST.
  // Primeiro busca a preferência por ID ou external_reference; se o gateway
  // continuar inconclusivo, responde 202 e deixa a reconciliação terminar.
  let preferencia = pedido.pagamentoIdExterno
    ? await (deps.obterPreferencia ?? obterPreferencia)(pedido.pagamentoIdExterno).catch(() => null)
    : null
  preferencia ??= await (deps.reconciliarPreferencia ?? reconciliarPreferencia)(pedido.id).catch(() => null)
  if (!preferencia) throw new CheckoutCanecaPagamentoIncertoError(pedido)

  await prisma.order.update({
    where: { id: pedido.id },
    data: {
      pagamentoIdExterno: preferencia.id,
      pagamentoMetodo: 'mercadopago',
      pagamentoResultadoIncerto: false,
    },
  })
  return { pedido, init_point: preferencia.init_point, retomado: true }
}

export async function criarCheckoutCanecaEvento(
  entrada: EntradaCheckoutCanecaEvento,
  deps: DependenciasCheckoutCaneca = {},
) {
  const agora = deps.agora?.() ?? new Date()
  const visitante = await prisma.eventoPirelliVisitante.findUnique({
    where: { codigoQr: entrada.codigoQr },
    select: {
      id: true,
      eventoId: true,
      nomeCompleto: true,
      whatsapp: true,
      evento: {
        select: {
          id: true,
          titulo: true,
          ativo: true,
          publicado: true,
          vendasAntecipadasAbertas: true,
          dataInicio: true,
          dataFim: true,
          valorCanecaAvulsa: true,
          limiteNomeGravacao: true,
        },
      },
    },
  })
  if (!visitante) throw new CheckoutCanecaEventoError('QR_NAO_ENCONTRADO', 404)
  if (!vendasEventoPirelliAbertas(visitante.evento, agora)) {
    throw new CheckoutCanecaEventoError('VENDAS_FECHADAS', 403)
  }
  if (entrada.nomeGravacao.length > visitante.evento.limiteNomeGravacao) {
    throw new CheckoutCanecaEventoError('NOME_GRAVACAO_INVALIDO', 400)
  }

  const retomado = await retomarTentativaCaneca(entrada, visitante, deps)
  if (retomado) return retomado

  const ano = agora.getFullYear()
  const expiraEm = calcularExpiracaoReserva(agora)
  let pedido: Awaited<ReturnType<typeof localizarPedidoDaTentativa>>
  let valorUnitario = 0

  try {
    pedido = await prisma.$transaction(async (tx) => {
      // Revalida QR, preço e abertura dentro da transação. Nenhuma chamada ao
      // Mercado Pago acontece enquanto locks do PostgreSQL estão retidos.
      const atual = await tx.eventoPirelliVisitante.findUnique({
        where: { codigoQr: entrada.codigoQr },
        select: {
          id: true,
          eventoId: true,
          nomeCompleto: true,
          whatsapp: true,
          evento: {
            select: {
              id: true,
              titulo: true,
              ativo: true,
              publicado: true,
              vendasAntecipadasAbertas: true,
              dataInicio: true,
              dataFim: true,
              valorCanecaAvulsa: true,
              limiteNomeGravacao: true,
            },
          },
        },
      })
      if (!atual || atual.id !== visitante.id || atual.eventoId !== visitante.eventoId) {
        throw new CheckoutCanecaEventoError('QR_NAO_ENCONTRADO', 404)
      }
      if (!vendasEventoPirelliAbertas(atual.evento, agora)) {
        throw new CheckoutCanecaEventoError('VENDAS_FECHADAS', 403)
      }
      if (entrada.nomeGravacao.length > atual.evento.limiteNomeGravacao) {
        throw new CheckoutCanecaEventoError('NOME_GRAVACAO_INVALIDO', 400)
      }

      valorUnitario = Number(atual.evento.valorCanecaAvulsa)
      if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) {
        throw new CheckoutCanecaEventoError('CANECA_INDISPONIVEL', 409)
      }
      valorUnitario = Number(valorUnitario.toFixed(2))

      const produto = await tx.product.upsert({
        where: { sku: SKU_CANECA_EVENTO_PIRELLI },
        create: {
          sku: SKU_CANECA_EVENTO_PIRELLI,
          slug: SLUG_CANECA_EVENTO_PIRELLI,
          nome: 'Caneca personalizada — Evento Pirelli',
          descricao: 'Caneca personalizada adquirida pelo checkout próprio da ação Pirelli.',
          preco: valorUnitario,
          precoPromocional: valorUnitario,
          estoque: 0,
          categoria: 'Canecas',
          marca: 'Forza Motos',
          ativo: true,
          destaque: false,
          preVenda: true,
          prazoEntregaDias: 1,
          eventoPirelliId: atual.eventoId,
          ordemEvento: 9_999,
          limitePorPedidoEvento: LIMITE_CANECA_POR_CHECKOUT,
          imagens: [],
          compatibilidadeMotos: [],
          ocultoManual: true,
          imagensVerificadas: true,
          temImagem: false,
        },
        update: {
          nome: 'Caneca personalizada — Evento Pirelli',
          descricao: 'Caneca personalizada adquirida pelo checkout próprio da ação Pirelli.',
          preco: valorUnitario,
          precoPromocional: valorUnitario,
          estoque: 0,
          categoria: 'Canecas',
          marca: 'Forza Motos',
          ativo: true,
          destaque: false,
          preVenda: true,
          prazoEntregaDias: 1,
          eventoPirelliId: atual.eventoId,
          ordemEvento: 9_999,
          limitePorPedidoEvento: LIMITE_CANECA_POR_CHECKOUT,
          ocultoManual: true,
          imagensVerificadas: true,
          temImagem: false,
        },
      })

      await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`checkout:${ano}`}, 0))`
      const sequencia = await tx.order.count({ where: { createdAt: { gte: new Date(`${ano}-01-01T00:00:00.000Z`) } } })
      const total = Number((valorUnitario * entrada.quantidade).toFixed(2))
      const criado = await tx.order.create({
        data: {
          orderNumber: gerarOrderNumber(sequencia + 1, ano),
          status: 'AGUARDANDO_PAGAMENTO',
          subtotal: total,
          frete: 0,
          desconto: 0,
          total,
          enderecoEntrega: {
            nome: atual.nomeCompleto,
            email: entrada.email,
            telefone: atual.whatsapp,
            cpf: entrada.cpf,
            modalidade: 'retirada_evento_pirelli',
            nomeGravacao: entrada.nomeGravacao,
          },
          pagamentoMetodo: 'mercadopago',
          freteServico: 'retirada',
          freteTransportadora: 'Retirada no evento Pirelli',
          fretePrazo: 1,
          canal: 'EVENTO_PIRELLI',
          eventoPirelliId: atual.eventoId,
          eventoPirelliVisitanteId: atual.id,
          checkoutTentativaId: entrada.checkoutTentativaId,
          pagamentoResultadoIncerto: true,
          reservaExpiraEm: expiraEm,
          items: {
            create: {
              productId: produto.id,
              quantidade: entrada.quantidade,
              precoUnitario: valorUnitario,
              estoqueReservado: false,
              preVendaSnapshot: true,
              prazoEntregaDiasSnapshot: 1,
            },
          },
          tracking: {
            create: {
              status: 'AGUARDANDO_PAGAMENTO',
              descricao: 'Compra de caneca personalizada criada — aguardando pagamento.',
            },
          },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          eventoPirelliId: true,
          eventoPirelliVisitanteId: true,
          pagamentoIdExterno: true,
          pagamentoResultadoIncerto: true,
          reservaExpiraEm: true,
          enderecoEntrega: true,
          items: {
            select: {
              quantidade: true,
              product: { select: { sku: true } },
            },
          },
        },
      })
      return criado
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concorrente = await retomarTentativaCaneca(entrada, visitante, deps)
      if (concorrente) return concorrente
    }
    throw error
  }

  if (!pedido) throw new CheckoutCanecaEventoError('PEDIDO_NAO_CRIADO', 500)

  let preferencia: Awaited<ReturnType<typeof criarPreferencia>>
  try {
    const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
    const token = encodeURIComponent(entrada.checkoutTentativaId)
    preferencia = await (deps.preferencia ?? criarPreferencia)({
      items: [{
        id: pedido.id,
        title: 'Caneca personalizada — Evento Pirelli',
        quantity: entrada.quantidade,
        unit_price: valorUnitario,
      }],
      payer: montarPayer({
        email: entrada.email,
        nome: visitante.nomeCompleto,
        telefone: visitante.whatsapp,
        cpf: entrada.cpf,
      }),
      external_reference: pedido.id,
      freteCusto: 0,
      back_urls: {
        success: `${baseUrl}/evento-pirelli/caneca/sucesso?token=${token}`,
        failure: `${baseUrl}/evento-pirelli/caneca/erro?token=${token}`,
        pending: `${baseUrl}/evento-pirelli/caneca/pendente?token=${token}`,
      },
      idempotencyKey: chaveIdempotenciaMP(`caneca-evento-pirelli:${pedido.id}`),
      expirationDateTo: pedido.reservaExpiraEm ?? expiraEm,
      somentePix: true,
    })
  } catch (error) {
    if (error instanceof ErroPreferenciaPagamento && !error.resultadoIncerto) {
      await cancelarPedidoComCompensacao(
        pedido.id,
        'Preferência da caneca rejeitada pelo gateway; tentativa encerrada com segurança.',
      )
      throw new CheckoutCanecaEventoError('PAGAMENTO_INDISPONIVEL', 502, true)
    }
    await prisma.orderTracking.create({
      data: {
        orderId: pedido.id,
        status: 'AGUARDANDO_PAGAMENTO',
        descricao: 'Resultado da preferência da caneca incerto; aguardando reconciliação do Mercado Pago.',
      },
    }).catch(() => {})
    throw new CheckoutCanecaPagamentoIncertoError(pedido)
  }

  await prisma.order.update({
    where: { id: pedido.id },
    data: {
      pagamentoIdExterno: preferencia.id,
      pagamentoMetodo: 'mercadopago',
      pagamentoResultadoIncerto: false,
    },
  }).catch((error) => console.error('[evento-pirelli/caneca] preferência criada; persistência pendente:', error))

  return { pedido, init_point: preferencia.init_point, retomado: false }
}
