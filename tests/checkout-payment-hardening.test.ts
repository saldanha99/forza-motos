import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import {
  cnpjValido,
  cpfValido,
  documentoFiscalValido,
  normalizarEnderecoCheckout,
} from '../lib/checkout/entrada'
import {
  ErroConsultaPagamentoMP,
  ErroValidacaoPagamentoMP,
  normalizarPagamentoMP,
  type PreferenciaMPNormalizada,
  validarPagamentoDoPedido,
  valorTotalPagamentoMP,
} from '../lib/checkout/mercadopago-webhook'
import {
  chaveIdempotenciaMP,
  montarPayer,
  pagamentoCanecaPirelliPermitido,
  tiposPagamentoExcluidos,
  tiposPagamentoExcluidosParaCheckout,
  tiposPagamentoExcluidosParaPix,
  validarAssinaturaMP,
} from '../lib/mercadopago'
import {
  calcularDescontoAvista,
  MEIOS_PAGAMENTO_CHECKOUT,
  normalizarMeioPagamentoCheckout,
  pagamentoCompativelComCheckout,
} from '../lib/checkout/desconto-avista'
import {
  calcularExpiracaoCompensacao,
  MINUTOS_COMPENSACAO_PAGAMENTO,
  pagamentoEmProcessamento,
} from '../lib/checkout/prazos-pagamento'
import { novaChaveIdempotenciaCliente } from '../lib/checkout/chave-idempotencia-cliente'
import { selecionarFreteDoServidor } from '../lib/checkout/calculo'

test('CPF/CNPJ validam dígitos verificadores e rejeitam sequências repetidas', () => {
  assert.equal(cpfValido('529.982.247-25'), true)
  assert.equal(cpfValido('529.982.247-24'), false)
  assert.equal(cpfValido('111.111.111-11'), false)
  assert.equal(cnpjValido('11.222.333/0001-81'), true)
  assert.equal(cnpjValido('11.222.333/0001-80'), false)
  assert.equal(cnpjValido('00.000.000/0000-00'), false)
  assert.equal(documentoFiscalValido('11.222.333/0001-81'), true)
})

test('checkout rejeita serviço privado forjado e aceita somente opção recotada no servidor', () => {
  const opcoes = [
    { id: '1', nome: 'PAC', preco: 12, prazo: 6 },
    { id: '2', nome: 'SEDEX', preco: 18, prazo: 2 },
    { id: 'retirada', nome: 'Retirada', preco: 0, prazo: 0 },
  ]

  assert.equal(selecionarFreteDoServidor(opcoes, '2').nome, 'SEDEX')
  assert.throws(() => selecionarFreteDoServidor(opcoes, '33'), /FRETE_INVALIDO/)
})

test('endereço do checkout é reduzido aos campos permitidos e normalizado', () => {
  const endereco = normalizarEnderecoCheckout({
    nome: '  Cliente\u0000 de Teste  ',
    email: ' CLIENTE@EXAMPLE.COM ',
    telefone: '(19) 99999-9999',
    cpf: '529.982.247-25',
    cep: '13073-041',
    rua: ' Rua de Teste ',
    numero: ' 120 ',
    complemento: '',
    bairro: 'Centro',
    cidade: 'Campinas',
    estado: 'sp',
    campoControladoPeloCliente: 'não deve persistir',
  }, undefined)
  assert.deepEqual(endereco, {
    nome: 'Cliente de Teste',
    email: 'cliente@example.com',
    telefone: '19999999999',
    cpf: '52998224725',
    cep: '13073041',
    rua: 'Rua de Teste',
    numero: '120',
    complemento: '',
    bairro: 'Centro',
    cidade: 'Campinas',
    estado: 'SP',
    whatsappTransacionalAutorizado: false,
  })

  assert.equal(normalizarEnderecoCheckout({
    ...endereco,
    whatsappTransacionalAutorizado: true,
  }, endereco.cpf).whatsappTransacionalAutorizado, true)
})

test('endereço incompleto, payload excessivo e documentos inválidos falham', () => {
  const base = {
    nome: 'Cliente de Teste', email: 'cliente@example.com', telefone: '19999999999', cpf: '52998224725',
    cep: '13073041', rua: 'Rua A', numero: '1', complemento: '', bairro: 'Centro',
    cidade: 'Campinas', estado: 'SP',
  }
  assert.throws(() => normalizarEnderecoCheckout({ ...base, cpf: '11111111111' }, undefined), /CPF_INVALIDO/)
  assert.throws(() => normalizarEnderecoCheckout({ ...base, telefone: '' }, undefined), /TELEFONE_INVALIDO/)
  assert.throws(() => normalizarEnderecoCheckout({ ...base, cidade: '' }, undefined), /ENDERECO_INVALIDO/)
  assert.throws(() => normalizarEnderecoCheckout({ ...base, rua: 'x'.repeat(151) }, undefined), /ENDERECO_INVALIDO/)
  assert.throws(() => normalizarEnderecoCheckout({ ...base, email: 'invalido' }, undefined), /EMAIL_INVALIDO/)
})

test('pagamento só confirma quando referência, valor, moeda, preferência e collector conferem', async () => {
  const anterior = process.env.MERCADOPAGO_COLLECTOR_ID
  process.env.MERCADOPAGO_COLLECTOR_ID = '1845338492'
  try {
    const payment = await normalizarPagamentoMP({
      id: 123,
      status: 'approved',
      external_reference: 'order-1',
      transaction_amount: 149.9,
      currency_id: 'BRL',
      preference_id: 'pref-1',
      collector_id: 1845338492,
      payment_method_id: 'pix',
    }, { resolverPreferencia: false })

    assert.deepEqual(
      await validarPagamentoDoPedido({ orderId: 'order-1', total: 149.9, preferenceId: 'pref-1', payment }),
      { preferenceId: 'pref-1' },
    )

    for (const [campo, valor, codigo] of [
      ['external_reference', 'outro', 'EXTERNAL_REFERENCE_DIVERGENTE'],
      ['transaction_amount', 1.49, 'VALOR_DIVERGENTE'],
      ['currency_id', 'USD', 'MOEDA_DIVERGENTE'],
      ['preference_id', 'outra', 'PREFERENCIA_DIVERGENTE'],
      ['collector_id', '999', 'COLLECTOR_DIVERGENTE'],
    ] as const) {
      const divergente = { ...payment, [campo]: valor }
      await assert.rejects(
        validarPagamentoDoPedido({ orderId: 'order-1', total: 149.9, preferenceId: 'pref-1', payment: divergente }),
        (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === codigo,
      )
    }
  } finally {
    if (anterior === undefined) delete process.env.MERCADOPAGO_COLLECTOR_ID
    else process.env.MERCADOPAGO_COLLECTOR_ID = anterior
  }
})

test('pagamento do Checkout Pro soma produto e frete separados pelo Mercado Pago', async () => {
  const anterior = process.env.MERCADOPAGO_COLLECTOR_ID
  process.env.MERCADOPAGO_COLLECTOR_ID = '1845338492'
  try {
    const payment = await normalizarPagamentoMP({
      id: 174283863811,
      status: 'approved',
      external_reference: 'order-com-frete',
      transaction_amount: 0.95,
      shipping_amount: 11.93,
      transaction_details: { total_paid_amount: 12.88 },
      currency_id: 'BRL',
      preference_id: 'pref-com-frete',
      collector_id: 1845338492,
      payment_method_id: 'pix',
      payment_type_id: 'bank_transfer',
    }, { resolverPreferencia: false })

    assert.equal(payment.transaction_amount, 0.95)
    assert.equal(payment.shipping_amount, 11.93)
    assert.equal(payment.total_paid_amount, 12.88)
    assert.equal(valorTotalPagamentoMP(payment), 12.88)
    assert.deepEqual(
      await validarPagamentoDoPedido({
        orderId: 'order-com-frete',
        total: 12.88,
        preferenceId: 'pref-com-frete',
        payment,
      }),
      { preferenceId: 'pref-com-frete' },
    )

    await assert.rejects(
      validarPagamentoDoPedido({
        orderId: 'order-com-frete',
        total: 12.88,
        preferenceId: 'pref-com-frete',
        payment: { ...payment, shipping_amount: 11.92 },
      }),
      (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === 'VALOR_DIVERGENTE',
    )
    await assert.rejects(
      validarPagamentoDoPedido({
        orderId: 'order-com-frete',
        total: 12.88,
        preferenceId: 'pref-com-frete',
        payment: { ...payment, total_paid_amount: 12.87 },
      }),
      (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === 'VALOR_DIVERGENTE',
    )
  } finally {
    if (anterior === undefined) delete process.env.MERCADOPAGO_COLLECTOR_ID
    else process.env.MERCADOPAGO_COLLECTOR_ID = anterior
  }
})

test('collector esperado é configuração obrigatória e falha fechado', async () => {
  const anterior = process.env.MERCADOPAGO_COLLECTOR_ID
  delete process.env.MERCADOPAGO_COLLECTOR_ID
  try {
    const payment = await normalizarPagamentoMP({
      id: '1', status: 'approved', external_reference: 'order-1', transaction_amount: 10,
      currency_id: 'BRL', preference_id: 'pref-1', collector_id: '123',
    }, { resolverPreferencia: false })
    await assert.rejects(
      validarPagamentoDoPedido({ orderId: 'order-1', total: 10, preferenceId: 'pref-1', payment }),
      ErroConsultaPagamentoMP,
    )
  } finally {
    if (anterior === undefined) delete process.env.MERCADOPAGO_COLLECTOR_ID
    else process.env.MERCADOPAGO_COLLECTOR_ID = anterior
  }
})

test('pagamento sem preference_id usa fallback oficial somente com vínculo completo', async () => {
  const anterior = process.env.MERCADOPAGO_COLLECTOR_ID
  process.env.MERCADOPAGO_COLLECTOR_ID = '1845338492'
  try {
    const payment = await normalizarPagamentoMP({
      id: '173115517284',
      status: 'pending',
      external_reference: 'order-1',
      transaction_amount: 149.9,
      currency_id: 'BRL',
      preference_id: null,
      collector_id: '1845338492',
      payment_method_id: 'bolbradesco',
      order: { id: 'merchant-order-1' },
    }, { resolverPreferencia: false })
    const preferencia: PreferenciaMPNormalizada = {
      id: 'pref-1',
      external_reference: 'order-1',
      collector_id: '1845338492',
      total: 149.9,
      currency_id: 'BRL',
    }
    let consultada: string | null = null

    assert.deepEqual(
      await validarPagamentoDoPedido(
        { orderId: 'order-1', total: 149.9, preferenceId: 'pref-1', payment },
        { consultarPreferencia: async (id) => {
          consultada = id
          return preferencia
        } },
      ),
      { preferenceId: 'pref-1' },
    )
    assert.equal(consultada, 'pref-1')

    const divergencias: Array<[Partial<PreferenciaMPNormalizada>, string]> = [
      [{ id: 'outra' }, 'PREFERENCIA_DIVERGENTE'],
      [{ external_reference: 'outro-pedido' }, 'PREFERENCIA_REFERENCIA_DIVERGENTE'],
      [{ collector_id: '999' }, 'PREFERENCIA_COLLECTOR_DIVERGENTE'],
      [{ currency_id: 'USD' }, 'PREFERENCIA_MOEDA_DIVERGENTE'],
      [{ total: 1.49 }, 'PREFERENCIA_VALOR_DIVERGENTE'],
    ]
    for (const [alteracao, codigo] of divergencias) {
      await assert.rejects(
        validarPagamentoDoPedido(
          { orderId: 'order-1', total: 149.9, preferenceId: 'pref-1', payment },
          { consultarPreferencia: async () => ({ ...preferencia, ...alteracao }) },
        ),
        (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === codigo,
      )
    }
  } finally {
    if (anterior === undefined) delete process.env.MERCADOPAGO_COLLECTOR_ID
    else process.env.MERCADOPAGO_COLLECTOR_ID = anterior
  }
})

test('fallback de preferência falha fechado sem âncora persistida ou merchant order', async () => {
  const anterior = process.env.MERCADOPAGO_COLLECTOR_ID
  process.env.MERCADOPAGO_COLLECTOR_ID = '123'
  try {
    const base = await normalizarPagamentoMP({
      id: '1', status: 'pending', external_reference: 'order-1', transaction_amount: 10,
      currency_id: 'BRL', collector_id: '123', order: { id: 'merchant-order-1' },
    }, { resolverPreferencia: false })
    await assert.rejects(
      validarPagamentoDoPedido({ orderId: 'order-1', total: 10, preferenceId: null, payment: base }),
      (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === 'PREFERENCIA_AUSENTE',
    )
    await assert.rejects(
      validarPagamentoDoPedido({
        orderId: 'order-1', total: 10, preferenceId: 'pref-1', payment: { ...base, order_id: null },
      }),
      (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === 'MERCHANT_ORDER_AUSENTE',
    )
  } finally {
    if (anterior === undefined) delete process.env.MERCADOPAGO_COLLECTOR_ID
    else process.env.MERCADOPAGO_COLLECTOR_ID = anterior
  }
})

test('merchant order 403 não impede normalizar pagamento para fallback seguro', async () => {
  const tokenAnterior = process.env.MERCADOPAGO_ACCESS_TOKEN
  const fetchAnterior = globalThis.fetch
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'token-de-teste'
  globalThis.fetch = async () => new Response('{}', { status: 403 })
  try {
    const payment = await normalizarPagamentoMP({
      id: '1', status: 'pending', external_reference: 'order-1', transaction_amount: 10,
      currency_id: 'BRL', collector_id: '123', order: { id: 'merchant-order-1' },
    })
    assert.equal(payment.preference_id, null)
    assert.equal(payment.order_id, 'merchant-order-1')
  } finally {
    globalThis.fetch = fetchAnterior
    if (tokenAnterior === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN
    else process.env.MERCADOPAGO_ACCESS_TOKEN = tokenAnterior
  }
})

test('assinatura do webhook falha fechado e usa comparação HMAC oficial', () => {
  const segredoAnterior = process.env.MERCADOPAGO_WEBHOOK_SECRET
  try {
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET
    assert.equal(
      validarAssinaturaMP({ xSignature: 'ts=1,v1=abcd', xRequestId: 'req', dataId: '123' }),
      false,
    )

    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo-qa'
    const ts = '1700000000'
    const manifesto = `id:123;request-id:req;ts:${ts};`
    const v1 = createHmac('sha256', 'segredo-qa').update(manifesto).digest('hex')
    assert.equal(
      validarAssinaturaMP({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req', dataId: '123' }),
      true,
    )
    assert.equal(
      validarAssinaturaMP({ xSignature: `ts=${ts},v1=${'0'.repeat(64)}`, xRequestId: 'req', dataId: '123' }),
      false,
    )
  } finally {
    if (segredoAnterior === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET
    else process.env.MERCADOPAGO_WEBHOOK_SECRET = segredoAnterior
  }
})

test('chave de idempotência do Mercado Pago é UUID estável por referência', () => {
  const a = chaveIdempotenciaMP('pedido:abc')
  const b = chaveIdempotenciaMP('pedido:abc')
  const c = chaveIdempotenciaMP('pedido:def')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('checkout novo oferece somente Pix no cliente e no servidor', () => {
  const checkout = readFileSync('app/(store)/checkout/page.tsx', 'utf8')
  const evento = readFileSync('app/api/eventos/[slug]/comprar/route.ts', 'utf8')
  const footer = readFileSync('components/store/Footer.tsx', 'utf8')
  const trustBar = readFileSync('components/store/TrustBar.tsx', 'utf8')
  const reviews = readFileSync('components/store/ReviewsSection.tsx', 'utf8')

  assert.deepEqual([...MEIOS_PAGAMENTO_CHECKOUT], ['PIX'])
  assert.equal(normalizarMeioPagamentoCheckout(' pix '), 'PIX')
  assert.throws(() => normalizarMeioPagamentoCheckout('boleto'), /FORMA_PAGAMENTO_INVALIDA/)
  assert.throws(() => normalizarMeioPagamentoCheckout('cartao'), /FORMA_PAGAMENTO_INVALIDA/)
  assert.doesNotMatch(checkout, /valor: 'BOLETO'/)
  assert.doesNotMatch(checkout, /valor: 'CARTAO'/)
  assert.match(checkout, /Pagamento à vista/)
  assert.match(checkout, /Telefone \/ WhatsApp \*/)
  assert.match(checkout, /telefone\.length < 10 \|\| telefone\.length > 13/)
  assert.match(checkout, /!form\.bairro \|\| !form\.cidade \|\| !form\.estado/)
  assert.match(evento, /somentePix: true/)
  assert.doesNotMatch(footer, /\['Visa', 'Master', 'Pix', 'Boleto'\]/)
  assert.match(footer, /Pagamento online: Pix/)
  assert.match(trustBar, /Pagamento via Pix/)
  assert.doesNotMatch(reviews, /trustindex/i)
  assert.doesNotMatch(reviews, /aggregateRating/)
  assert.match(reviews, /Ver avaliações no Google/)
})

test('pagamento em compensação preserva a reserva por pelo menos 3 dias', () => {
  const agora = new Date('2026-08-20T12:00:00.000Z')
  const expiraEm = calcularExpiracaoCompensacao(agora)

  assert.equal(pagamentoEmProcessamento('pending'), true)
  assert.equal(pagamentoEmProcessamento('in_process'), true)
  assert.equal(pagamentoEmProcessamento('authorized'), true)
  assert.equal(pagamentoEmProcessamento('in_mediation'), true)
  assert.equal(pagamentoEmProcessamento('rejected'), false)
  assert.ok(MINUTOS_COMPENSACAO_PAGAMENTO >= 3 * 24 * 60)
  assert.equal(
    expiraEm.getTime() - agora.getTime(),
    MINUTOS_COMPENSACAO_PAGAMENTO * 60_000,
  )
})

test('meios de pagamento desativados usam somente tipos aceitos pelo Mercado Pago', () => {
  assert.deepEqual(
    tiposPagamentoExcluidos({ acceptCards: true, acceptTicket: false, acceptPix: false }),
    [{ id: 'ticket' }, { id: 'bank_transfer' }],
  )
  assert.equal(
    tiposPagamentoExcluidos({ acceptCards: false, acceptTicket: false, acceptPix: false })
      .some((tipo) => tipo.id === 'account_money'),
    false,
  )
})

test('Pix recebe 5% após cupom e o frete fica fora da base', () => {
  assert.equal(calcularDescontoAvista(100, 0, 'PIX'), 5)
  assert.equal(calcularDescontoAvista(100, 10, 'PIX'), 4.5)
  assert.equal(calcularDescontoAvista(199.99, 0, 'PIX'), 10)
  assert.equal(calcularDescontoAvista(100, 100, 'PIX'), 0)

  assert.equal(normalizarMeioPagamentoCheckout(' pix '), 'PIX')
  assert.throws(() => normalizarMeioPagamentoCheckout('boleto'), /FORMA_PAGAMENTO_INVALIDA/)
  assert.throws(() => normalizarMeioPagamentoCheckout('cartao'), /FORMA_PAGAMENTO_INVALIDA/)
  assert.throws(() => normalizarMeioPagamentoCheckout('dinheiro'), /FORMA_PAGAMENTO_INVALIDA/)
})

test('preferência Pix exclui cartão e boleto e o webhook confere a modalidade aprovada', () => {
  const pixExcluidos = tiposPagamentoExcluidosParaCheckout('PIX').map((tipo) => tipo.id)
  assert.equal(pixExcluidos.includes('credit_card'), true)
  assert.equal(pixExcluidos.includes('ticket'), true)
  assert.equal(pixExcluidos.includes('bank_transfer'), false)

  assert.equal(pagamentoCompativelComCheckout('PIX', 'pix', 'bank_transfer'), true)
  assert.equal(pagamentoCompativelComCheckout('PIX', 'master', 'credit_card'), false)
  assert.equal(pagamentoCompativelComCheckout('PIX', 'account_money', 'account_money'), true)
  assert.equal(pagamentoCompativelComCheckout('BOLETO', 'bolbradesco', 'ticket'), true)
  assert.equal(pagamentoCompativelComCheckout('CARTAO', 'master', 'credit_card'), true)
})

test('caneca Pirelli deixa Pix e saldo Mercado Pago e rejeita os demais meios', () => {
  const excluidos = tiposPagamentoExcluidosParaPix().map((tipo) => tipo.id)
  assert.deepEqual(excluidos, [
    'credit_card', 'debit_card', 'prepaid_card', 'ticket',
    'digital_currency', 'atm',
  ])
  assert.equal(excluidos.includes('bank_transfer'), false, 'bank_transfer é o tipo do Pix')
  assert.equal(excluidos.includes('account_money'), false, 'saldo Mercado Pago não pode ser excluído')
  assert.equal(pagamentoCanecaPirelliPermitido('pix'), true)
  assert.equal(pagamentoCanecaPirelliPermitido('account_money'), true)
  assert.equal(pagamentoCanecaPirelliPermitido('credit_card'), false)

  const caneca = readFileSync('lib/checkout/caneca-evento-pirelli.ts', 'utf8')
  const preferencia = readFileSync('lib/mercadopago.ts', 'utf8')
  const maquina = readFileSync('lib/checkout/webhook-pagamento.ts', 'utf8')
  assert.match(caneca, /somentePix: true/)
  assert.match(preferencia, /default_payment_method_id = 'pix'/)
  assert.match(maquina, /pagamentoCanecaPirelliPermitido\(payment\.payment_method_id\)/)
  assert.match(maquina, /metodo_pagamento_invalido/)
  assert.match(maquina, /processarEstornoRegistrado\(orderId, paymentId, motivo, deps\)/)
})

test('payer do Mercado Pago separa o DDD de telefone nacional e E.164 brasileiro', () => {
  assert.deepEqual(
    montarPayer({ email: 'teste@example.com', telefone: '(19) 99999-9999' })?.phone,
    { area_code: '19', number: '999999999' },
  )
  assert.deepEqual(
    montarPayer({ email: 'teste@example.com', telefone: '+55 19 99999-9999' })?.phone,
    { area_code: '19', number: '999999999' },
  )
  assert.equal(
    montarPayer({ email: 'teste@example.com', telefone: '12345-6789' })?.phone,
    undefined,
  )
})

test('caixa presencial exige confirmação e guarda auditoria idempotente', () => {
  const rota = readFileSync('app/api/admin/evento-pirelli/atendimento/route.ts', 'utf8')
  const atendimento = readFileSync('components/evento-pirelli/AtendimentoEventoPirelli.tsx', 'utf8')
  const migration = readFileSync('prisma/migrations/20260901120000_evento_pirelli_pdv_presencial/migration.sql', 'utf8')
  const migrationSemNsu = readFileSync('prisma/migrations/20260901170000_evento_pirelli_pdv_sem_nsu/migration.sql', 'utf8')
  assert.match(rota, /body\.acao === 'criar-venda-presencial'/)
  assert.match(rota, /body\.acao === 'confirmar-venda-presencial'/)
  assert.match(rota, /pg_advisory_xact_lock/)
  assert.doesNotMatch(rota, /referenciaPagamentoObrigatoria/)
  assert.match(rota, /eventoPirelliLancamentoCaixa\.create/)
  assert.match(rota, /CHAVE_IDEMPOTENCIA_REUTILIZADA/)
  assert.match(migration, /EventoPirelliVendaPresencial_chaveIdempotencia_key/)
  assert.match(migration, /AGUARDANDO_PAGAMENTO/)
  assert.match(migration, /EventoPirelliVendaPresencial_status_check/)
  assert.match(migration, /EventoPirelliVendaPresencial_referencia_pagamento_check/)
  assert.match(migrationSemNsu, /DROP CONSTRAINT IF EXISTS "EventoPirelliLancamentoCaixa_referenciaPagamento_check"/)
  assert.match(migrationSemNsu, /DROP CONSTRAINT IF EXISTS "EventoPirelliVendaPresencial_referencia_pagamento_check"/)
  assert.match(atendimento, /Criar venda pendente/)
  assert.match(atendimento, /Pagamento aprovado — confirmar/)
  assert.doesNotMatch(atendimento, /NSU, autorização ou referência/)
  assert.match(atendimento, /Nada entra no caixa, na fila de gravação ou nos brindes enquanto o pagamento estiver pendente/)
})

test('checkout mantém a loja acompanhando o Pix e preserva o carrinho até a confirmação', () => {
  const checkout = readFileSync('app/(store)/checkout/page.tsx', 'utf8')
  const pedido = readFileSync('lib/checkout/pedido.ts', 'utf8')

  assert.match(checkout, /window\.open\('about:blank', '_blank'\)/)
  assert.match(checkout, /abaPagamento\.location\.replace\(data\.init_point\)/)
  assert.match(checkout, /window\.location\.assign\(`\/checkout\/sucesso\?token=/)
  assert.match(checkout, /window\.location\.assign\(data\.init_point\)/)
  assert.doesNotMatch(
    checkout.match(/if \(data\.init_point\) \{([\s\S]*?)\} else if/)?.[1] ?? '',
    /limpar\(\)/,
  )
  assert.match(checkout, /signal: AbortSignal\.timeout\(TEMPO_LIMITE_CHECKOUT_MS\)/)
  assert.match(checkout, /Seu carrinho foi preservado; tente novamente/)
  assert.doesNotMatch(checkout, /disabled=\{!freteSelecionado\}/)
  assert.match(checkout, /Selecione uma opção de frete acima para continuar/)
  assert.match(pedido, /pedido\.pagamentoIdExterno[\s\S]{0,180}obterPreferencia/)
  assert.match(pedido, /pref \?\?= await \(deps\.reconciliarPreferencia \?\? reconciliarPreferencia\)/)
})

test('tentativas do checkout têm UUID compatível e chamadas ao Mercado Pago têm limite de espera', () => {
  const chave = novaChaveIdempotenciaCliente()
  const preferencia = readFileSync('lib/mercadopago.ts', 'utf8')
  const gerador = readFileSync('lib/checkout/chave-idempotencia-cliente.ts', 'utf8')

  assert.match(chave, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.match(gerador, /getRandomValues/)
  assert.equal(
    preferencia.match(/signal: AbortSignal\.timeout\(TEMPO_LIMITE_MERCADO_PAGO_MS\)/g)?.length,
    3,
  )
})

test('webhook e reconciliação compartilham o pós-pagamento idempotente', () => {
  const webhook = readFileSync('app/api/mercadopago/webhook/route.ts', 'utf8')
  const maquinaPagamento = readFileSync('lib/checkout/webhook-pagamento.ts', 'utf8')
  const reconciliacao = readFileSync('lib/checkout/reconciliacao.ts', 'utf8')
  const efeitos = readFileSync('lib/checkout/efeitos-pedido-confirmado.ts', 'utf8')
  const notificacoes = readFileSync('lib/checkout/notificacoes-pedido.ts', 'utf8')
  const filaEmail = readFileSync('lib/email/queue.ts', 'utf8')
  const filaWhatsApp = readFileSync('lib/evolution/queue.ts', 'utf8')
  const email = readFileSync('lib/email/send.ts', 'utf8')

  assert.match(webhook, /import \{ efeitosPedidoConfirmado \} from '@\/lib\/checkout\/efeitos-pedido-confirmado'/)
  assert.match(reconciliacao, /processarEfeitosPedidoConfirmado\?: typeof efeitosPedidoConfirmado/)
  assert.match(reconciliacao, /await processarEfeitos\(pedido\.id, aprovado\.payment_method_id\)/)
  assert.doesNotMatch(webhook, /async function efeitosPedidoConfirmado/)

  // A aprovação financeira cria as duas obrigações na mesma transação.
  assert.match(maquinaPagamento, /await agendarNotificacoesClientePedido\(orderId, tx\)/)
  assert.match(notificacoes, /chaveIdempotencia: `pedido:\$\{orderId\}:whatsapp:confirmado`/)
  assert.match(notificacoes, /chaveIdempotencia: `pedido:\$\{orderId\}:email:confirmado`/)
  assert.match(notificacoes, /notificacoesAgendadasEm: new Date\(\)/)

  // Filas usam UPSERT, SKIP LOCKED, lease recuperável e CAS de tentativa.
  for (const fila of [filaEmail, filaWhatsApp]) {
    assert.match(fila, /upsert\(/)
    assert.match(fila, /FOR UPDATE SKIP LOCKED/)
    assert.match(fila, /leaseExpiraEm/)
    assert.match(fila, /tentativas:/)
  }
  assert.match(filaEmail, /idempotencyKey: email\.chaveIdempotencia/)
  assert.match(efeitos, /processarMensagem\(outboxes\.whatsappId\)/)
  assert.match(efeitos, /processarEmail\(outboxes\.emailId\)/)
  assert.match(efeitos, /pg_advisory_xact_lock\(hashtextextended/)
  assert.match(email, /getResend\(\)\.emails\.send\([\s\S]*?, requestOptions\)/)
})

test('retorno do produto usa token opaco e polling escopado, nunca orderId público', () => {
  const pedido = readFileSync('lib/checkout/pedido.ts', 'utf8')
  const status = readFileSync('app/api/checkout/status/route.ts', 'utf8')
  const pagina = readFileSync('app/(store)/checkout/sucesso/page.tsx', 'utf8')
  const cliente = readFileSync('components/store/StatusPagamentoPedido.tsx', 'utf8')

  assert.match(pedido, /checkout\/sucesso\?token=/)
  assert.match(status, /where: \{ checkoutTentativaId: token \}/)
  assert.match(status, /orderIds: \[pedido\.id\]/)
  assert.doesNotMatch(status, /searchParams\.get\(['"]orderId/)
  assert.match(pagina, /checkoutTentativaId: token/)
  assert.match(cliente, /api\/checkout\/status\?token=/)
})
