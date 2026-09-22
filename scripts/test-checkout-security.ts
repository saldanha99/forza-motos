/**
 * Fixtures de segurança do checkout.
 *
 * Este script ESCREVE no banco apontado por DATABASE_URL. Por isso ele só roda
 * com opt-in explícito e contra um banco cujo nome bate exatamente com a lista
 * permitida — `--help` não toca em nada.
 *
 *   CRM_FIXTURE_TESTS=1 npx tsx scripts/test-checkout-security.ts
 *   CRM_FIXTURE_TESTS=1 CHECKOUT_TEST_DB=forzamotos_r4a npx tsx scripts/...
 */
import { loadEnvConfig } from '@next/env'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { criarPedidoSeguro, PedidoPagamentoIncertoError } from '@/lib/checkout/pedido'
import { ErroPreferenciaPagamento } from '@/lib/mercadopago'
import { cancelarPedidoComCompensacao } from '@/lib/checkout/reserva'
import { processarPagamentoPedido } from '@/lib/checkout/webhook-pagamento'
import { processarReembolsosPendentes } from '@/lib/checkout/pagamento'
import { reconciliarCheckout } from '@/lib/checkout/reconciliacao'
import { efeitosPedidoConfirmado } from '@/lib/checkout/efeitos-pedido-confirmado'

const USO = `
Fixtures de segurança do checkout (escrevem no banco).

Uso:
  CRM_FIXTURE_TESTS=1 npx tsx scripts/test-checkout-security.ts

Variáveis:
  CRM_FIXTURE_TESTS=1   obrigatória — opt-in explícito para rodar as fixtures
  CHECKOUT_TEST_DB      nome de um banco de teste adicional autorizado
                        (além de "forzamotos_dev")

--help / -h imprime esta mensagem e sai sem tocar em nada.
`.trim()

// --help ANTES de qualquer efeito colateral (nem env, nem Prisma, nem fixtures).
if (process.argv.slice(2).some((arg) => arg === '--help' || arg === '-h')) {
  console.log(USO)
  process.exit(0)
}

loadEnvConfig(process.cwd())

/**
 * Guard do banco alvo.
 *
 * Um `includes('forzamotos_dev')` aceitaria
 * `postgres://.../forzamotos?opts=forzamotos_dev` e escreveria em produção.
 * Aqui protocolo e NOME DO BANCO são comparados exatamente.
 */
function bancoAutorizado(databaseUrl: string | undefined): string {
  if (!databaseUrl) throw new Error('DATABASE_URL não configurada')
  let url: URL
  try {
    url = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL não é uma URL válida')
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`Protocolo não suportado: ${url.protocol}`)
  }
  const nome = decodeURIComponent(url.pathname.replace(/^\//, ''))
  const permitidos = new Set(['forzamotos_dev'])
  if (process.env.CHECKOUT_TEST_DB) permitidos.add(process.env.CHECKOUT_TEST_DB)
  permitidos.delete('forzamotos') // produção nunca, nem por CHECKOUT_TEST_DB
  if (!permitidos.has(nome)) {
    throw new Error(
      `Banco "${nome}" não autorizado para fixtures. Permitidos: ${Array.from(permitidos).join(', ')}`,
    )
  }
  return nome
}

if (process.env.CRM_FIXTURE_TESTS !== '1') {
  console.error('Recusado: defina CRM_FIXTURE_TESTS=1 para rodar fixtures que escrevem no banco.')
  console.error(USO)
  process.exit(1)
}
const NOME_BANCO = bancoAutorizado(process.env.DATABASE_URL)

// ── Rede: tudo bloqueado, exceto o que cada cenário autorizar ──────────────
const fetchOriginal = globalThis.fetch
type RotaFalsa = { teste: (url: string) => boolean; responder: (url: string, init?: any) => Response }

function bloquearRede(rotas: RotaFalsa[] = []) {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input))
    const rota = rotas.find((r) => r.teste(url))
    if (rota) return rota.responder(url, init)
    throw new Error(`CHAMADA EXTERNA NÃO AUTORIZADA no teste: ${url}`)
  }) as typeof globalThis.fetch
}
function liberarRede() {
  globalThis.fetch = fetchOriginal
}

const preferenciaFalsa = (n: number) => ({
  id: `pref-qa-${n}`,
  init_point: 'https://example.invalid/qa',
  sandbox_init_point: null,
})

/** Contagens antes/depois — a prova de que nenhuma fixture ficou para trás. */
async function contagens() {
  const [products, orders, orderItems, tracking, cupons, tentativas, reembolsos] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.orderTracking.count(),
    prisma.cupom.count(),
    prisma.pagamentoTentativa.count(),
    prisma.reembolsoPagamento.count(),
  ])
  return { products, orders, orderItems, tracking, cupons, tentativas, reembolsos }
}

async function limparPedidos(ids: string[]) {
  if (!ids.length) return
  await prisma.reembolsoPagamento.deleteMany({ where: { orderId: { in: ids } } })
  await prisma.pagamentoTentativa.deleteMany({ where: { orderId: { in: ids } } })
  await prisma.orderTracking.deleteMany({ where: { orderId: { in: ids } } })
  await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } })
  await prisma.order.deleteMany({ where: { id: { in: ids } } })
}

/**
 * Limpeza dirigida pelos produtos da fixture: descobre os pedidos pelo próprio
 * banco em vez de depender de uma lista montada no caminho feliz. Sem isso, uma
 * assertion que falha no meio deixa lixo e a exceção da limpeza mascara o erro
 * real.
 */
async function limparFixtura(productIds: string[]) {
  try {
    const itens = await prisma.orderItem.findMany({
      where: { productId: { in: productIds } },
      select: { orderId: true },
    })
    await limparPedidos(Array.from(new Set(itens.map((i) => i.orderId))))
    await prisma.product.deleteMany({ where: { id: { in: productIds } } })
  } catch (e) {
    console.error('[limpeza] falhou:', e)
    throw e
  }
}

const freteRetirada: any = [{ id: 'retirada', nome: 'Retirar', transportadora: 'Loja', preco: 0, prazo: 0, fonte: 'loja' }]
const freteServidor: any = [{
  id: 'qa-frete',
  nome: 'Frete QA',
  transportadora: 'Transportadora QA',
  preco: 37.45,
  prazo: 4,
  fonte: 'melhor-envio',
}]

function enderecoFixture(email: string, nome = 'Cliente QA') {
  return {
    nome,
    email,
    telefone: '19999999999',
    cpf: '52998224725',
    cep: '13060080',
    rua: 'Rua de Teste',
    numero: '120',
    complemento: '',
    bairro: 'Centro',
    cidade: 'Campinas',
    estado: 'SP',
  }
}

async function pagamentoFixture(
  orderId: string,
  paymentId: string,
  status: string,
  metodo = 'pix',
) {
  const pedido = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { total: true, pagamentoIdExterno: true },
  })
  return {
    id: paymentId,
    status,
    status_detail: null,
    external_reference: orderId,
    transaction_amount: Number(pedido.total),
    currency_id: 'BRL',
    preference_id: pedido.pagamentoIdExterno,
    collector_id: 'qa-collector',
    payment_method_id: metodo,
    payment_type_id: metodo === 'pix'
      ? 'bank_transfer'
      : metodo.startsWith('bol')
        ? 'ticket'
        : 'credit_card',
    order_id: null,
  }
}

async function main() {
  process.env.MERCADOPAGO_COLLECTOR_ID = 'qa-collector'
  console.log(`Banco de fixtures: ${NOME_BANCO}`)
  const antes = await contagens()
  console.log('contagens ANTES:', JSON.stringify(antes))

  const marcadorBase = `qa-checkout-base-${Date.now()}`
  const p = await prisma.product.create({ data: {
    sku: marcadorBase, slug: marcadorBase, nome: 'QA Checkout Base', descricao: 'Fixture descartável',
    preco: 129.9, estoque: 2, categoria: 'QA', marca: 'QA', ativo: true, ocultoManual: false,
  } })
  const before = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
  let gatewayCalls = 0
  let ordem: any
  let preferenciaRecebida: any
  try {
    try {
      await criarPedidoSeguro({
        items: [{ productId: p.id, quantidade: 1, precoUnitario: 1 } as any],
        subtotal: 1,
        frete: 999,
        freteServico: 'qa-frete',
        meioPagamento: 'CARTAO',
        cpf: '52998224725',
        checkoutTentativaId: randomUUID(),
        enderecoEntrega: enderecoFixture('qa@invalid.test', 'Cliente QA'),
      } as any, null, {
        cotar: async () => freteServidor,
        verificarEstoque: async () => ({ ok: true, esgotados: [] }),
        preferencia: async (dados: any) => {
          gatewayCalls += 1
          preferenciaRecebida = dados
          throw new ErroPreferenciaPagamento('mock rejeitado antes da criação', false)
        },
      })
      assert.fail('deveria falhar')
    } catch (e: any) { assert.equal(e.message, 'PAGAMENTO_INDISPONIVEL') }
    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
    assert.equal(after.estoque, before.estoque); assert.equal(after.estoqueReservado, 0); assert.equal(after.ativo, before.ativo); assert.equal(gatewayCalls, 1)
    assert.equal(preferenciaRecebida.items[0].unit_price, Number(p.preco))
    assert.equal(preferenciaRecebida.freteCusto, 37.45)
    ordem = await prisma.order.findFirst({ where: { enderecoEntrega: { path: ['email'], equals: 'qa@invalid.test' } }, orderBy: { createdAt: 'desc' } })
    assert.equal(ordem?.status, 'CANCELADO')
    assert.equal(Number(ordem?.subtotal), Number(p.preco))
    assert.equal(Number(ordem?.frete), 37.45)
    assert.equal(Math.round(Number(ordem?.total) * 100), Math.round((Number(p.preco) + 37.45) * 100))
    assert.equal(ordem?.freteTransportadora, 'Transportadora QA')
    assert.equal(ordem?.fretePrazo, 4)
    console.log('OK preço/frete manipulados foram recalculados; gateway falhou; reserva foi devolvida')
  } finally {
    await limparFixtura([p.id])
  }

  // ── Concorrência na última unidade (guard transacional) ─────────────────
  const marcador = `qa-checkout-concorrencia-${Date.now()}`
  const produtoConcorrencia = await prisma.product.create({ data: {
    sku: marcador, slug: marcador, nome: 'QA Checkout Concorrência', descricao: 'Fixture descartável',
    preco: 199.9, estoque: 1, categoria: 'QA', marca: 'QA', ativo: true, ocultoManual: false,
  } })
  let liberarVerificacoes!: () => void
  const verificacoesProntas = new Promise<void>((resolve) => { liberarVerificacoes = resolve })
  let verificacoes = 0
  let preferencias = 0
  const depsConcorrencia: any = {
    cotar: async () => freteRetirada,
    // Pré-check propositalmente cego: quem precisa segurar a linha é o guard
    // transacional `estoque - estoqueReservado >= qtd`.
    verificarEstoque: async () => {
      verificacoes += 1
      if (verificacoes === 2) liberarVerificacoes()
      await verificacoesProntas
      return { ok: true, esgotados: [] }
    },
    preferencia: async () => preferenciaFalsa(++preferencias),
  }
  let pedidosConcorrencia: { id: string }[] = []
  try {
    const body = (): any => ({
      items: [{ productId: produtoConcorrencia.id, quantidade: 1, precoUnitario: 0.01 }],
      subtotal: 0.01,
      frete: 999,
      freteServico: 'retirada',
      meioPagamento: 'CARTAO',
      cpf: '52998224725',
      checkoutTentativaId: randomUUID(),
      enderecoEntrega: enderecoFixture(`${marcador}@invalid.test`, 'Cliente Concorrência'),
    })
    const resultados = await Promise.allSettled([
      criarPedidoSeguro(body(), null, depsConcorrencia),
      criarPedidoSeguro(body(), null, depsConcorrencia),
    ])
    assert.equal(resultados.filter((item) => item.status === 'fulfilled').length, 1)
    const rejeitado = resultados.find((item): item is PromiseRejectedResult => item.status === 'rejected')
    assert.equal(rejeitado?.reason?.message, 'ESTOQUE_INSUFICIENTE')
    assert.equal(preferencias, 1)
    const final = await prisma.product.findUniqueOrThrow({ where: { id: produtoConcorrencia.id } })
    // Físico intacto (o Olist ainda não baixou), disponível zerado pela reserva.
    assert.equal(final.estoque, 1); assert.equal(final.estoqueReservado, 1); assert.equal(final.ativo, false)
    pedidosConcorrencia = await prisma.order.findMany({ where: { enderecoEntrega: { path: ['email'], equals: `${marcador}@invalid.test` } }, select: { id: true } })
    assert.equal(pedidosConcorrencia.length, 1)
    console.log('OK concorrência da última unidade criou um pedido e uma preferência')
  } finally {
    await limparFixtura([produtoConcorrencia.id])
  }

  // ── B1: sync do Tiny ATIVO durante checkouts sequenciais ────────────────
  // O Tiny insiste que há 2 unidades e o verificador reescreve o saldo físico
  // a cada checkout (atualizarBanco=true). Antes, essa reposição acontecia
  // ANTES do débito da reserva e cada checkout encontrava o saldo cheio.
  const marcadorB1 = `qa-b1-sync-${Date.now()}`
  const produtoB1 = await prisma.product.create({ data: {
    sku: marcadorB1, slug: marcadorB1, nome: 'QA B1 Sync Tiny', descricao: 'Fixture descartável',
    preco: 100, estoque: 2, categoria: 'QA', marca: 'QA', ativo: true, ocultoManual: false,
    temImagem: true, tinyId: `qa-tiny-${Date.now()}`,
  } })
  process.env.OLIST_TOKEN = process.env.OLIST_TOKEN || 'qa-token-fixture'
  let chamadasTiny = 0
  let prefsB1 = 0
  let pedidosB1: { id: string }[] = []
  try {
    bloquearRede([{
      teste: (url) => url.includes('tiny.com.br'),
      responder: () => {
        chamadasTiny += 1
        return Response.json({ retorno: { status: 'OK', produto: { depositos: [{ deposito: { nome: 'Loja', saldo: 2 } }] } } })
      },
    }])
    const deps: any = {
      cotar: async () => freteRetirada,
      // verificarEstoque REAL — é ele que sobrescreve Product.estoque.
      preferencia: async () => preferenciaFalsa(++prefsB1),
    }
    const corpo = (sufixo: string): any => ({
      items: [{ productId: produtoB1.id, quantidade: 1 }], freteServico: 'retirada', cpf: '52998224725',
      meioPagamento: 'CARTAO',
      checkoutTentativaId: randomUUID(),
      enderecoEntrega: enderecoFixture(`${marcadorB1}-${sufixo}@invalid.test`, 'Cliente B Um'),
    })

    await criarPedidoSeguro(corpo('a'), null, deps)
    const apos1 = await prisma.product.findUniqueOrThrow({ where: { id: produtoB1.id } })
    assert.equal(apos1.estoque, 2, 'sync manteve o saldo físico do Tiny')
    assert.equal(apos1.estoqueReservado, 1, 'reserva sobreviveu à sobrescrita do Tiny')

    await criarPedidoSeguro(corpo('b'), null, deps)
    const apos2 = await prisma.product.findUniqueOrThrow({ where: { id: produtoB1.id } })
    assert.equal(apos2.estoque, 2); assert.equal(apos2.estoqueReservado, 2)
    assert.equal(apos2.ativo, false, 'sem disponível, sai da vitrine mesmo com o Tiny dizendo 2')

    // Terceiro checkout: o Tiny continua dizendo 2, mas 2 já estão reservadas.
    // Reativa o produto à mão, simulando um sync que só olha o saldo físico —
    // é exatamente o cenário em que o oversell acontecia. A reserva tem de
    // segurar a venda mesmo com o produto de volta à vitrine.
    await prisma.product.update({ where: { id: produtoB1.id }, data: { ativo: true } })
    await assert.rejects(
      criarPedidoSeguro(corpo('c'), null, deps),
      // O trigger pode retirar o produto da vitrine antes do pré-check
      // (PRODUTO_INVALIDO), ou a reserva atômica pode vencê-lo logo depois
      // (ESTOQUE_INSUFICIENTE). Ambos impedem a terceira preferência.
      (e: any) => ['PRODUTO_INVALIDO', 'ESTOQUE_INSUFICIENTE'].includes(e.message),
    )
    assert.equal(prefsB1, 2, 'nunca mais preferências que unidades')
    assert.ok(chamadasTiny >= 2, `verificador real consultou o Tiny nas compras aceitas (${chamadasTiny} chamadas)`)

    pedidosB1 = await prisma.order.findMany({ where: { items: { some: { productId: produtoB1.id } } }, select: { id: true } })
    assert.equal(pedidosB1.length, 2)
    console.log('OK B1: com o sync do Tiny ativo, 2 unidades geraram exatamente 2 pedidos/preferências')
  } finally {
    liberarRede()
    await limparFixtura([produtoB1.id])
  }

  // ── Resultado incerto + retomada idempotente ────────────────────────────
  const marcadorIncerto = `qa-checkout-incerto-${Date.now()}`
  const produtoIncerto = await prisma.product.create({ data: {
    sku: marcadorIncerto, slug: marcadorIncerto, nome: 'QA Resultado Incerto', descricao: 'Fixture descartável',
    preco: 149.9, estoque: 2, categoria: 'QA', marca: 'QA', ativo: true, ocultoManual: false,
  } })
  const codigoCupom = `QA${Date.now()}`
  await prisma.cupom.create({ data: { codigo: codigoCupom, tipo: 'VALOR', valor: 10, usoMaximo: 1, usados: 0, ativo: true } })
  const tentativaId = randomUUID()
  const bodyIncerto: any = {
    items: [{ productId: produtoIncerto.id, quantidade: 1 }], freteServico: 'retirada', cpf: '52998224725',
    meioPagamento: 'CARTAO',
    cupomCodigo: codigoCupom, checkoutTentativaId: tentativaId,
    enderecoEntrega: enderecoFixture(`${marcadorIncerto}@invalid.test`, 'Cliente Incerto'),
  }
  const depsBase: any = {
    cotar: async () => freteRetirada,
    verificarEstoque: async () => ({ ok: true, esgotados: [] }),
  }
  let chamadasCriacao = 0
  let pedidoIncerto: any
  try {
    try {
      await criarPedidoSeguro(bodyIncerto, null, {
        ...depsBase,
        preferencia: async () => { chamadasCriacao += 1; throw new ErroPreferenciaPagamento('timeout depois do envio', true) },
      })
      assert.fail('resultado incerto deveria retornar estado pendente')
    } catch (error) {
      assert.ok(error instanceof PedidoPagamentoIncertoError)
      pedidoIncerto = (error as PedidoPagamentoIncertoError).pedido
    }

    const aposTimeout = await prisma.product.findUniqueOrThrow({ where: { id: produtoIncerto.id } })
    const cupomAposTimeout = await prisma.cupom.findUniqueOrThrow({ where: { codigo: codigoCupom } })
    const orderAposTimeout = await prisma.order.findUniqueOrThrow({ where: { id: pedidoIncerto.id } })
    assert.equal(aposTimeout.estoque, 2); assert.equal(aposTimeout.estoqueReservado, 1)
    assert.equal(cupomAposTimeout.usados, 1)
    assert.equal(orderAposTimeout.status, 'AGUARDANDO_PAGAMENTO')
    assert.equal(orderAposTimeout.pagamentoResultadoIncerto, true)
    assert.ok(orderAposTimeout.reservaExpiraEm, 'reserva nasce com prazo')

    const retomado = await criarPedidoSeguro(bodyIncerto, null, {
      ...depsBase,
      preferencia: async () => { chamadasCriacao += 1; throw new Error('retry não pode recriar preferência') },
      reconciliarPreferencia: async () => ({ id: 'pref-reconciliada', init_point: 'https://example.invalid/reconciliada', sandbox_init_point: null }),
    })
    assert.equal(retomado.pedido.id, pedidoIncerto.id)
    assert.equal(retomado.init_point, 'https://example.invalid/reconciliada')
    assert.equal(chamadasCriacao, 1)
    assert.equal((await prisma.order.count({ where: { checkoutTentativaId: tentativaId } })), 1)
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: produtoIncerto.id } })).estoqueReservado, 1)
    assert.equal((await prisma.cupom.findUniqueOrThrow({ where: { codigo: codigoCupom } })).usados, 1)

    assert.equal(await cancelarPedidoComCompensacao(pedidoIncerto.id, 'QA cancelamento'), true)
    assert.equal(await cancelarPedidoComCompensacao(pedidoIncerto.id, 'QA retry cancelamento'), false)
    const aposCancelar = await prisma.product.findUniqueOrThrow({ where: { id: produtoIncerto.id } })
    assert.equal(aposCancelar.estoque, 2); assert.equal(aposCancelar.estoqueReservado, 0)
    assert.equal((await prisma.cupom.findUniqueOrThrow({ where: { codigo: codigoCupom } })).usados, 0)
    console.log('OK timeout manteve reservas; retry reconciliou sem novo POST; compensação ocorreu exatamente uma vez')
  } finally {
    await limparFixtura([produtoIncerto.id])
    await prisma.cupom.deleteMany({ where: { codigo: codigoCupom } })
  }

  // ── Cancelamento misto (reserva real x pré-venda) ───────────────────────
  const marcadorMisto = `qa-cancelamento-misto-${Date.now()}`
  const [produtoRegular, produtoPreVenda] = await Promise.all([
    prisma.product.create({ data: {
      sku: `${marcadorMisto}-regular`, slug: `${marcadorMisto}-regular`, nome: 'QA Regular Reservado', descricao: 'Fixture',
      preco: 50, estoque: 1, estoqueReservado: 1, categoria: 'QA', marca: 'QA', ativo: false, ocultoManual: false,
    } }),
    prisma.product.create({ data: {
      sku: `${marcadorMisto}-prevenda`, slug: `${marcadorMisto}-prevenda`, nome: 'QA Pré-venda', descricao: 'Fixture',
      preco: 50, estoque: 0, categoria: 'QA', marca: 'QA', ativo: true, ocultoManual: false, preVenda: true,
    } }),
  ])
  const pedidoMisto = await prisma.order.create({ data: {
    orderNumber: `QA-MISTO-${Date.now()}`, subtotal: 100, frete: 0, desconto: 0, total: 100,
    enderecoEntrega: {}, status: 'AGUARDANDO_PAGAMENTO', pagamentoResultadoIncerto: true,
    items: { create: [
      { productId: produtoRegular.id, quantidade: 1, precoUnitario: 50, estoqueReservado: true },
      { productId: produtoPreVenda.id, quantidade: 1, precoUnitario: 50, estoqueReservado: false },
    ] },
  } })
  try {
    assert.equal(await cancelarPedidoComCompensacao(pedidoMisto.id, 'QA misto'), true)
    assert.equal(await cancelarPedidoComCompensacao(pedidoMisto.id, 'QA misto retry'), false)
    const regular = await prisma.product.findUniqueOrThrow({ where: { id: produtoRegular.id } })
    assert.equal(regular.estoque, 1); assert.equal(regular.estoqueReservado, 0)
    const prevenda = await prisma.product.findUniqueOrThrow({ where: { id: produtoPreVenda.id } })
    assert.equal(prevenda.estoque, 0); assert.equal(prevenda.estoqueReservado, 0)
    console.log('OK cancelamento devolveu uma vez apenas a reserva real; pré-venda permaneceu intacta')
  } finally {
    await limparFixtura([produtoRegular.id, produtoPreVenda.id])
  }

  // ── Concorrência de cupom ───────────────────────────────────────────────
  const marcadorCupom = `qa-cupom-concorrencia-${Date.now()}`
  const produtoCupom = await prisma.product.create({ data: {
    sku: marcadorCupom, slug: marcadorCupom, nome: 'QA Cupom Concorrência', descricao: 'Fixture descartável',
    preco: 99.9, estoque: 2, categoria: 'QA', marca: 'QA', ativo: true, ocultoManual: false,
  } })
  const cupomConcorrente = `QAC${Date.now()}`
  await prisma.cupom.create({ data: { codigo: cupomConcorrente, tipo: 'VALOR', valor: 5, usoMaximo: 1, usados: 0, ativo: true } })
  let pedidosCupom: { id: string }[] = []
  let prefsCupom = 0
  try {
    const fazerBody = (sufixo: string): any => ({
      items: [{ productId: produtoCupom.id, quantidade: 1 }], freteServico: 'retirada', cpf: '52998224725',
      meioPagamento: 'CARTAO',
      cupomCodigo: cupomConcorrente, checkoutTentativaId: randomUUID(),
      enderecoEntrega: enderecoFixture(`${marcadorCupom}-${sufixo}@invalid.test`, 'Cliente Cupom'),
    })
    const deps: any = { ...depsBase, preferencia: async () => preferenciaFalsa(++prefsCupom) }
    const resultados = await Promise.allSettled([
      criarPedidoSeguro(fazerBody('a'), null, deps),
      criarPedidoSeguro(fazerBody('b'), null, deps),
    ])
    assert.equal(resultados.filter((item) => item.status === 'fulfilled').length, 1)
    const rejeitado = resultados.find((item): item is PromiseRejectedResult => item.status === 'rejected')
    assert.match(String(rejeitado?.reason?.message), /^CUPOM:/)
    assert.equal(prefsCupom, 1)
    assert.equal((await prisma.cupom.findUniqueOrThrow({ where: { codigo: cupomConcorrente } })).usados, 1)
    const prodCupom = await prisma.product.findUniqueOrThrow({ where: { id: produtoCupom.id } })
    assert.equal(prodCupom.estoque, 2); assert.equal(prodCupom.estoqueReservado, 1)
    pedidosCupom = await prisma.order.findMany({ where: { cupomCodigo: cupomConcorrente }, select: { id: true } })
    assert.equal(pedidosCupom.length, 1)
    console.log('OK último uso de cupom foi autorizado atomicamente com um único pedido/reserva')
  } finally {
    await limparFixtura([produtoCupom.id])
    await prisma.cupom.deleteMany({ where: { codigo: cupomConcorrente } })
  }

  await cenarioB2()
  await cenarioB3()
  await cenarioP13()
  await cenarioP14()
  await cenarioP12()

  const depois = await contagens()
  console.log('contagens DEPOIS:', JSON.stringify(depois))
  assert.deepEqual(depois, antes, 'toda fixture criada precisa ter sido removida')
  console.log('OK contagens antes/depois idênticas — nenhuma fixture ficou no banco')
}

/** Cria um pedido pendente real (com reserva) para os cenários de webhook. */
async function pedidoPendente(
  marcador: string,
  estoque: number,
  opts: { tinyId?: string | null; meioPagamento?: 'PIX' | 'BOLETO' | 'CARTAO' } = {},
) {
  const produto = await prisma.product.create({ data: {
    sku: marcador, slug: marcador, nome: `QA ${marcador}`, descricao: 'Fixture descartável',
    preco: 80, estoque, categoria: 'QA', marca: 'QA', ativo: true, ocultoManual: false,
    tinyId: opts.tinyId ?? null,
  } })
  const { pedido } = await criarPedidoSeguro(
    {
      items: [{ productId: produto.id, quantidade: 1 }], freteServico: 'retirada', cpf: '52998224725',
      meioPagamento: opts.meioPagamento ?? 'PIX',
      checkoutTentativaId: randomUUID(),
      enderecoEntrega: enderecoFixture(`${marcador}@invalid.test`, 'Cliente Webhook'),
    } as any,
    null,
    {
      cotar: async () => freteRetirada,
      verificarEstoque: async () => ({ ok: true, esgotados: [] }),
      preferencia: async () => preferenciaFalsa(1),
    } as any,
  )
  return { produto, pedido }
}

// ── B2: rejeitada seguida de aprovada ──────────────────────────────────────
async function cenarioB2() {
  const marcador = `qa-b2-${Date.now()}`
  const { produto, pedido } = await pedidoPendente(marcador, 3)
  try {
    const rejeitadaId = `${marcador}-pay-1`
    const rejeitada = await processarPagamentoPedido(
      pedido.id,
      rejeitadaId,
      await pagamentoFixture(pedido.id, rejeitadaId, 'rejected', 'visa'),
    )
    assert.deepEqual(rejeitada, { tipo: 'tentativa_nao_aprovada', status: 'rejected', novo: true })

    const aposRejeicao = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } })
    assert.equal(aposRejeicao.status, 'AGUARDANDO_PAGAMENTO', 'uma tentativa recusada NÃO encerra o pedido')
    const prodAposRejeicao = await prisma.product.findUniqueOrThrow({ where: { id: produto.id } })
    assert.equal(prodAposRejeicao.estoqueReservado, 1, 'reserva permanece para a próxima tentativa')

    // Mesmo comprador, mesma preferência, outro meio de pagamento: aprovado.
    const aprovadaId = `${marcador}-pay-2`
    const aprovada = await processarPagamentoPedido(
      pedido.id,
      aprovadaId,
      await pagamentoFixture(pedido.id, aprovadaId, 'approved', 'pix'),
    )
    assert.deepEqual(aprovada, { tipo: 'confirmado', orderId: pedido.id })

    const final = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } })
    assert.equal(final.status, 'CONFIRMADO')
    assert.equal(final.pagamentoMetodo, 'pix')
    assert.ok(final.reservaLiberadaEm, 'a reserva virou venda')
    const prodFinal = await prisma.product.findUniqueOrThrow({ where: { id: produto.id } })
    assert.equal(prodFinal.estoque, 2, 'baixa física de 1 unidade')
    assert.equal(prodFinal.estoqueReservado, 0)
    assert.equal(await prisma.pagamentoTentativa.count({ where: { orderId: pedido.id } }), 2)
    assert.equal(await prisma.reembolsoPagamento.count({ where: { orderId: pedido.id } }), 0, 'compra legítima não gera estorno')

    // Reentrega do MESMO evento aprovado não baixa estoque de novo.
    const reentrega = await processarPagamentoPedido(
      pedido.id,
      aprovadaId,
      await pagamentoFixture(pedido.id, aprovadaId, 'approved', 'pix'),
    )
    assert.equal(reentrega.tipo, 'ja_processado')
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: produto.id } })).estoque, 2)
    console.log('OK B2: recusa não encerra o pedido e a aprovação seguinte confirma a compra')
  } finally {
    await limparFixtura([produto.id])
  }

  // Aprovação que chega DEPOIS do pedido já encerrado: estorno obrigatório.
  const marcador2 = `qa-b2b-${Date.now()}`
  const { produto: produto2, pedido: pedido2 } = await pedidoPendente(marcador2, 2, { meioPagamento: 'CARTAO' })
  try {
    assert.equal(await cancelarPedidoComCompensacao(pedido2.id, 'QA expiração'), true)
    let chamadasRefund = 0
    const pagamentoId = `${marcador2}-pay`
    const resultado = await processarPagamentoPedido(
      pedido2.id,
      pagamentoId,
      await pagamentoFixture(pedido2.id, pagamentoId, 'approved', 'visa'),
      { reembolso: { solicitarReembolso: async () => { chamadasRefund += 1; return { ok: true, status: 201, corpo: '{}' } } } },
    )
    assert.equal(resultado.tipo, 'aprovado_apos_encerramento')
    assert.equal((resultado as any).estorno, 'CONCLUIDO')
    assert.equal(chamadasRefund, 1)
    const estorno = await prisma.reembolsoPagamento.findUniqueOrThrow({ where: { paymentId: pagamentoId } })
    assert.equal(estorno.status, 'CONCLUIDO')
    assert.ok(estorno.concluidoEm)
    const prod2 = await prisma.product.findUniqueOrThrow({ where: { id: produto2.id } })
    assert.equal(prod2.estoque, 2); assert.equal(prod2.estoqueReservado, 0, 'nada é revendido às escondidas')
    console.log('OK B2: aprovação sobre pedido encerrado vira obrigação durável de estorno')
  } finally {
    await limparFixtura([produto2.id])
  }
}

// ── B3: estorno que falha não pode virar "reembolso solicitado" ────────────
async function cenarioB3() {
  const marcador = `qa-b3-${Date.now()}`
  const { produto, pedido } = await pedidoPendente(marcador, 1, { meioPagamento: 'CARTAO' })
  try {
    // O físico sumiu entre o checkout e o pagamento (venda no balcão).
    await prisma.product.update({ where: { id: produto.id }, data: { estoque: 0 } })

    let tentativasRefund = 0
    const pagamentoId = `${marcador}-pay`
    const resultado = await processarPagamentoPedido(
      pedido.id,
      pagamentoId,
      await pagamentoFixture(pedido.id, pagamentoId, 'approved', 'visa'),
      { reembolso: { solicitarReembolso: async () => { tentativasRefund += 1; return { ok: false, status: 401, corpo: '{"message":"unauthorized"}' } } } },
    )
    assert.equal(resultado.tipo, 'cancelado_sem_estoque')
    assert.equal((resultado as any).estorno, 'PENDENTE', 'HTTP 401 NÃO conta como estorno solicitado')
    assert.equal(tentativasRefund, 1)

    const estorno = await prisma.reembolsoPagamento.findUniqueOrThrow({ where: { paymentId: pagamentoId } })
    assert.equal(estorno.status, 'PENDENTE')
    assert.equal(estorno.tentativas, 1)
    assert.match(String(estorno.ultimoErro), /401/)
    assert.ok(estorno.proximaTentativaEm, 'fica agendado para nova tentativa')
    assert.equal(await prisma.orderTracking.count({ where: { orderId: pedido.id, status: 'REEMBOLSO:PENDENTE' } }), 1)

    const pedidoCancelado = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } })
    assert.equal(pedidoCancelado.status, 'CANCELADO')

    // A reconciliação insiste até um resultado conclusivo.
    await prisma.reembolsoPagamento.update({ where: { id: estorno.id }, data: { proximaTentativaEm: new Date(Date.now() - 1000) } })
    const resumo = await processarReembolsosPendentes(10, { solicitarReembolso: async () => ({ ok: true, status: 201, corpo: '{}' }) })
    assert.ok(resumo.concluidos >= 1)
    const final = await prisma.reembolsoPagamento.findUniqueOrThrow({ where: { id: estorno.id } })
    assert.equal(final.status, 'CONCLUIDO')
    assert.equal(final.tentativas, 2)
    console.log('OK B3: estorno falho permanece PENDENTE com erro gravado e é reconciliado até concluir')
  } finally {
    await limparFixtura([produto.id])
  }
}

// ── P1.3: última unidade, produto sem tinyId ───────────────────────────────
async function cenarioP13() {
  const marcador = `qa-p13-${Date.now()}`
  const { produto, pedido } = await pedidoPendente(marcador, 1, { tinyId: null })
  try {
    const antes = await prisma.product.findUniqueOrThrow({ where: { id: produto.id } })
    assert.equal(antes.estoque, 1); assert.equal(antes.estoqueReservado, 1)

    // Verificador REAL: sem tinyId não há rede; a checagem cai no saldo local.
    bloquearRede()
    const pagamentoId = `${marcador}-pay`
    const resultado = await processarPagamentoPedido(
      pedido.id,
      pagamentoId,
      await pagamentoFixture(pedido.id, pagamentoId, 'approved', 'pix'),
    )
    assert.deepEqual(resultado, { tipo: 'confirmado', orderId: pedido.id }, 'a última unidade paga NÃO pode ser cancelada')

    const final = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } })
    assert.equal(final.status, 'CONFIRMADO')
    assert.equal(await prisma.reembolsoPagamento.count({ where: { orderId: pedido.id } }), 0)
    const prod = await prisma.product.findUniqueOrThrow({ where: { id: produto.id } })
    assert.equal(prod.estoque, 0); assert.equal(prod.estoqueReservado, 0)
    console.log('OK P1.3: última unidade sem tinyId confirma o pedido pago em vez de cancelá-lo')
  } finally {
    liberarRede()
    await limparFixtura([produto.id])
  }
}

// ── P1.4: falha transitória do MP não vira ACK ─────────────────────────────
async function cenarioP14() {
  const { POST } = await import('@/app/api/mercadopago/webhook/route')
  const segredoOriginal = process.env.MERCADOPAGO_WEBHOOK_SECRET
  const tokenOriginal = process.env.MERCADOPAGO_ACCESS_TOKEN
  process.env.MERCADOPAGO_WEBHOOK_SECRET = 'qa-secret'
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'qa-token'
  const paymentId = `qa-p14-${Date.now()}`

  const requisicao = (assinar: boolean) => {
    const ts = String(Date.now())
    const manifesto = `id:${paymentId.toLowerCase()};request-id:qa-req;ts:${ts};`
    const v1 = createHmac('sha256', assinar ? 'qa-secret' : 'segredo-errado').update(manifesto).digest('hex')
    return new Request('https://forzamotos.test/api/mercadopago/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'qa-req' },
      body: JSON.stringify({ type: 'payment', data: { id: paymentId } }),
    })
  }

  try {
    bloquearRede([{ teste: (u) => u.includes('api.mercadopago.com'), responder: () => new Response('erro', { status: 500 }) }])
    const res500 = await POST(requisicao(true))
    assert.ok(res500.status >= 500, 'MP fora do ar precisa gerar reentrega, não ACK')

    bloquearRede([{ teste: (u) => u.includes('api.mercadopago.com'), responder: () => new Response('nao encontrado', { status: 404 }) }])
    const res404 = await POST(requisicao(true))
    assert.ok(res404.status >= 500, '404 assinado pode ser consistência eventual e precisa de reentrega')

    const resAssinatura = await POST(requisicao(false))
    assert.equal(resAssinatura.status, 401)

    // Fail-closed: sem segredo configurado, nada é aceito.
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET
    const resSemSegredo = await POST(requisicao(true))
    assert.equal(resSemSegredo.status, 401, 'sem MERCADOPAGO_WEBHOOK_SECRET o webhook falha FECHADO')
    console.log('OK P1.4: falha do MP responde 5xx; assinatura inválida/ausente é rejeitada')
  } finally {
    liberarRede()
    if (segredoOriginal === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET
    else process.env.MERCADOPAGO_WEBHOOK_SECRET = segredoOriginal
    if (tokenOriginal === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN
    else process.env.MERCADOPAGO_ACCESS_TOKEN = tokenOriginal
  }
}

// ── P1.2: reconciliação converge e nunca cancela às cegas ──────────────────
async function cenarioP12() {
  const marcador = `qa-p12-${Date.now()}`
  const { produto, pedido } = await pedidoPendente(marcador, 2)
  const vencido = new Date(Date.now() - 60_000)
  try {
    await prisma.order.update({ where: { id: pedido.id }, data: { reservaExpiraEm: vencido } })

    // 1) MP inacessível: reserva PRESERVADA (nunca cancelar sem saber).
    const indeterminado = await reconciliarCheckout({
      buscarPagamentos: async () => { throw new Error('MP fora do ar') },
      reconciliarPreferencia: async () => null,
      agora: new Date(),
    }, { orderIds: [pedido.id] })
    assert.ok(indeterminado.indeterminados >= 1)
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } })).status, 'AGUARDANDO_PAGAMENTO')
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: produto.id } })).estoqueReservado, 1)

    // 2) Resposta conclusiva sem pagamento: expira e compensa.
    await reconciliarCheckout({
      buscarPagamentos: async () => [],
      reconciliarPreferencia: async () => null,
      agora: new Date(),
    }, { orderIds: [pedido.id] })
    const expirado = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } })
    assert.equal(expirado.status, 'CANCELADO')
    const prod = await prisma.product.findUniqueOrThrow({ where: { id: produto.id } })
    assert.equal(prod.estoque, 2); assert.equal(prod.estoqueReservado, 0, 'reserva vencida volta ao pool')
    console.log('OK P1.2: reconciliação preserva a reserva quando não sabe e expira quando sabe')
  } finally {
    await limparFixtura([produto.id])
  }

  // 3) Pagamento aprovado que nunca virou webhook converge pela reconciliação.
  const marcador3 = `qa-p12b-${Date.now()}`
  const { produto: produto3, pedido: pedido3 } = await pedidoPendente(marcador3, 2)
  const integracoesOriginal = process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS
  try {
    process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS = 'false'
    await prisma.order.update({ where: { id: pedido3.id }, data: { reservaExpiraEm: new Date(Date.now() - 60_000) } })
    const pagamentoId = `${marcador3}-pay`
    const pagamentoAprovado = await pagamentoFixture(pedido3.id, pagamentoId, 'approved', 'pix')
    let efeitosChamados = 0
    await reconciliarCheckout({
      buscarPagamentos: async () => [pagamentoAprovado],
      reconciliarPreferencia: async () => null,
      processarEfeitosPedidoConfirmado: async (orderId, metodo) => {
        efeitosChamados += 1
        assert.equal(orderId, pedido3.id)
        assert.equal(metodo, 'pix')
        await efeitosPedidoConfirmado(orderId, metodo)
      },
      agora: new Date(),
    }, { orderIds: [pedido3.id] })
    const confirmado = await prisma.order.findUniqueOrThrow({ where: { id: pedido3.id } })
    assert.equal(confirmado.status, 'CONFIRMADO', 'webhook perdido não pode cancelar uma compra paga')
    const prod3 = await prisma.product.findUniqueOrThrow({ where: { id: produto3.id } })
    assert.equal(prod3.estoque, 1); assert.equal(prod3.estoqueReservado, 0)
    assert.equal(efeitosChamados, 1, 'reconciliação deve acionar o pós-pagamento ao confirmar')

    // Reentrada concorrente do webhook/reconciliador não pode duplicar a
    // outbox: o advisory lock + marcador deixam exatamente uma conclusão.
    await Promise.all([
      efeitosPedidoConfirmado(pedido3.id, 'pix'),
      efeitosPedidoConfirmado(pedido3.id, 'pix'),
    ])
    assert.equal(await prisma.orderTracking.count({
      where: { orderId: pedido3.id, status: 'EFEITO:INTEGRACOES_DESABILITADAS' },
    }), 1)

    await reconciliarCheckout({
      buscarPagamentos: async () => [pagamentoAprovado],
      processarEfeitosPedidoConfirmado: async () => { efeitosChamados += 1 },
      agora: new Date(),
    }, { orderIds: [pedido3.id] })
    assert.equal(efeitosChamados, 1, 'pedido já confirmado não deve repetir o pós-pagamento')
    console.log('OK P1.2: pagamento aprovado sem webhook confirma e executa efeitos uma única vez')
  } finally {
    if (integracoesOriginal === undefined) delete process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS
    else process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS = integracoesOriginal
    await limparFixtura([produto3.id])
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
