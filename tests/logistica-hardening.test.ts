import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import {
  calcularSubtotalServidor,
  normalizarItensCotacao,
} from '../lib/frete/cotacao-segura'
import { chaveNfeValida, exigirChaveNfe, exigirInscricaoEstadual } from '../lib/frete/nfe'
import { executarComLease } from '../lib/frete/operacao-com-lease'
import {
  respostaMinimaRastreio,
  verificacaoRastreioConfere,
} from '../lib/frete/rastreamento-seguro'
import { assinaturaWebhookMelhorEnvioValida } from '../lib/frete/webhook-me-seguranca'
import {
  ehServicoMelhorEnvio,
  idServicoFallback,
  origemServicoFrete,
} from '../lib/frete/servico'
import { gerarEObterImpressao } from '../lib/frete/geracao-etiqueta'
import { analisarEstadoEnvioRemoto, statusPedidoDoEnvioRemoto } from '../lib/frete/estado-envio'
import {
  ErroMelhorEnvio,
  SERVICOS_CORREIOS_LOJA,
  baixarEtiquetaPdfME,
  cotarMelhorEnvio,
  extrairUrlPdfMelhorEnvio,
  resultadoCompraPodeSerIncerto,
  servicoCorreiosHabilitado,
  servicoCompativelComFluxo,
} from '../lib/frete/melhor-envio'
import { calcularMercadoriasLiquidas } from '../lib/frete/valores-mercadoria'

function chaveNfeFixture(): string {
  const base = '3519081234567800019555001000001234100001234'
  assert.equal(base.length, 43)
  const chave = Array.from({ length: 10 }, (_, digito) => `${base}${digito}`)
    .find(chaveNfeValida)
  assert.ok(chave)
  return chave
}

test('cotação agrupa quantidades e calcula subtotal só com preço do servidor', () => {
  const itens = normalizarItensCotacao([
    { productId: 'p1', quantidade: 1, preco: 0.01 },
    { productId: 'p1', quantidade: 2, frete: -100 },
    { productId: 'p2', quantidade: 1 },
  ])
  assert.deepEqual(itens, [
    { productId: 'p1', quantidade: 3 },
    { productId: 'p2', quantidade: 1 },
  ])
  assert.equal(
    calcularSubtotalServidor(itens, [
      { id: 'p1', preco: 100, precoPromocional: 80 },
      { id: 'p2', preco: 25 },
    ]),
    265,
  )
  assert.throws(() => normalizarItensCotacao([{ productId: 'p1', quantidade: -1 }]))
})

test('origem do serviço diferencia Melhor Envio, retirada e fallback numérico legado', () => {
  assert.equal(idServicoFallback('04510'), 'fallback:04510')
  assert.equal(origemServicoFrete('fallback:04014'), 'fallback')
  assert.equal(origemServicoFrete('04510'), 'fallback')
  assert.equal(origemServicoFrete('04014'), 'fallback')
  assert.equal(origemServicoFrete('2'), 'melhor-envio')
  assert.equal(origemServicoFrete('retirada'), 'retirada')
  assert.equal(origemServicoFrete(null), 'indefinido')
  assert.equal(ehServicoMelhorEnvio('3'), true)
  assert.equal(ehServicoMelhorEnvio('sedex-manual'), false)
})

test('geração assíncrona aguarda o PDF e permite retry sem gerar novamente', async () => {
  let geracoes = 0
  let impressoes = 0
  const esperas: number[] = []
  const resultado = await gerarEObterImpressao({
    gerar: async () => { geracoes++ },
    imprimir: async () => {
      impressoes++
      return impressoes === 2 ? { url: 'https://melhorenvio.test/etiqueta.pdf' } : {}
    },
    esperasMs: [10, 20],
    esperar: async (ms) => { esperas.push(ms) },
  })
  assert.deepEqual(resultado, { url: 'https://melhorenvio.test/etiqueta.pdf' })
  assert.equal(geracoes, 1)
  assert.equal(impressoes, 2)
  assert.deepEqual(esperas, [10, 20])

  geracoes = 0
  const recuperado = await gerarEObterImpressao({
    tentarImpressaoInicial: true,
    gerar: async () => { geracoes++ },
    imprimir: async () => ({ url: 'https://melhorenvio.test/pronta.pdf' }),
    esperar: async () => {},
  })
  assert.equal(recuperado.url, 'https://melhorenvio.test/pronta.pdf')
  assert.equal(geracoes, 0)
})

test('geração assíncrona informa retry seguro quando o PDF continua indisponível', async () => {
  await assert.rejects(
    gerarEObterImpressao({
      gerar: async () => {},
      imprimir: async () => { throw new Error('ainda processando') },
      esperasMs: [0, 0],
      esperar: async () => {},
    }),
    /não haverá nova cobrança/,
  )
})

test('download converte a lista de URL temporária do Melhor Envio em PDF sem repassar o token', async () => {
  const fetchOriginal = globalThis.fetch
  const tokenOriginal = process.env.MELHOR_ENVIO_TOKEN
  const urlOriginal = process.env.MELHOR_ENVIO_URL
  process.env.MELHOR_ENVIO_TOKEN = 'token-somente-no-primeiro-request'
  process.env.MELHOR_ENVIO_URL = 'https://melhorenvio.test/api/v2'
  const urlPdf = 'https://me-0047-prod.s3.amazonaws.com/pdf/etiqueta-teste.pdf?assinatura=temporaria'
  const chamadas: string[] = []

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    chamadas.push(url)
    if (url.endsWith('/me/imprimir/pdf/envio-1')) {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer token-somente-no-primeiro-request')
      return new Response(JSON.stringify([urlPdf]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    assert.equal(url, urlPdf)
    assert.equal(new Headers(init?.headers).has('Authorization'), false)
    return new Response(new TextEncoder().encode('%PDF-1.7\nfixture'), {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    })
  }

  try {
    const pdf = await baixarEtiquetaPdfME('envio-1')
    assert.equal(pdf.contentType, 'application/pdf')
    assert.equal(new TextDecoder().decode(pdf.conteudo).startsWith('%PDF-'), true)
    assert.deepEqual(chamadas, [
      'https://melhorenvio.test/api/v2/me/imprimir/pdf/envio-1',
      urlPdf,
    ])
  } finally {
    globalThis.fetch = fetchOriginal
    if (tokenOriginal === undefined) delete process.env.MELHOR_ENVIO_TOKEN
    else process.env.MELHOR_ENVIO_TOKEN = tokenOriginal
    if (urlOriginal === undefined) delete process.env.MELHOR_ENVIO_URL
    else process.env.MELHOR_ENVIO_URL = urlOriginal
  }
})

test('download de etiqueta aceita só links PDF HTTPS do Melhor Envio ou S3', () => {
  assert.equal(
    extrairUrlPdfMelhorEnvio(['https://me-0047-prod.s3.amazonaws.com/pdf/etiqueta.pdf?x=1']),
    'https://me-0047-prod.s3.amazonaws.com/pdf/etiqueta.pdf?x=1',
  )
  assert.equal(
    extrairUrlPdfMelhorEnvio({ url: 'https://www.melhorenvio.com.br/pdf/etiqueta.pdf' }),
    'https://www.melhorenvio.com.br/pdf/etiqueta.pdf',
  )
  assert.equal(extrairUrlPdfMelhorEnvio(['http://169.254.169.254/pdf/segredo.pdf']), null)
  assert.equal(extrairUrlPdfMelhorEnvio(['https://evil.example/pdf/etiqueta.pdf']), null)
  assert.equal(extrairUrlPdfMelhorEnvio(['https://me-0047-prod.s3.amazonaws.com/arquivo.txt']), null)
})

test('download preserva resposta PDF direta e rejeita redirecionamento malicioso', async () => {
  const fetchOriginal = globalThis.fetch
  const tokenOriginal = process.env.MELHOR_ENVIO_TOKEN
  const urlOriginal = process.env.MELHOR_ENVIO_URL
  process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste'
  process.env.MELHOR_ENVIO_URL = 'https://melhorenvio.test/api/v2'
  let chamadas = 0

  try {
    globalThis.fetch = async () => {
      chamadas += 1
      return new Response(new TextEncoder().encode('%PDF-1.7\ndireto'), {
        headers: { 'Content-Type': 'application/pdf' },
      })
    }
    const direto = await baixarEtiquetaPdfME('envio-direto')
    assert.equal(direto.contentType, 'application/pdf')
    assert.equal(chamadas, 1)

    chamadas = 0
    globalThis.fetch = async () => {
      chamadas += 1
      return new Response(JSON.stringify(['http://169.254.169.254/pdf/segredo.pdf']), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    await assert.rejects(baixarEtiquetaPdfME('envio-malicioso'), /link de PDF inválido/)
    assert.equal(chamadas, 1)

    chamadas = 0
    globalThis.fetch = async () => {
      chamadas += 1
      if (chamadas === 1) {
        return new Response(JSON.stringify([
          'https://me-0047-prod.s3.amazonaws.com/pdf/etiqueta.pdf?assinatura=temporaria',
        ]), { headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(null, {
        status: 302,
        headers: { Location: 'http://169.254.169.254/pdf/segredo.pdf' },
      })
    }
    await assert.rejects(baixarEtiquetaPdfME('envio-redirecionado'), /destino inválido/)
    assert.equal(chamadas, 2)
  } finally {
    globalThis.fetch = fetchOriginal
    if (tokenOriginal === undefined) delete process.env.MELHOR_ENVIO_TOKEN
    else process.env.MELHOR_ENVIO_TOKEN = tokenOriginal
    if (urlOriginal === undefined) delete process.env.MELHOR_ENVIO_URL
    else process.env.MELHOR_ENVIO_URL = urlOriginal
  }
})

test('estado remoto confirma compra e geração sem regressão financeira', () => {
  assert.deepEqual(analisarEstadoEnvioRemoto({ status: 'pending' }), {
    status: 'pending', comprada: false, gerada: false, cancelada: false,
  })
  assert.deepEqual(analisarEstadoEnvioRemoto({ status: 'released', paid_at: '2026-08-22' }), {
    status: 'released', comprada: true, gerada: false, cancelada: false,
  })
  assert.deepEqual(analisarEstadoEnvioRemoto({ status: 'posted', generated_at: '2026-08-22' }), {
    status: 'posted', comprada: true, gerada: true, cancelada: false,
  })
  assert.deepEqual(analisarEstadoEnvioRemoto({ status: 'cancelled', canceled_at: '2026-08-22' }), {
    status: 'cancelled', comprada: false, gerada: false, cancelada: true,
  })
  assert.equal(
    resultadoCompraPodeSerIncerto(new ErroMelhorEnvio('indisponível', 503, '/checkout')),
    true,
  )
  assert.equal(
    resultadoCompraPodeSerIncerto(new ErroMelhorEnvio('saldo insuficiente', 422, '/checkout')),
    false,
  )
})

test('estado remoto converge postagem e entrega sem depender do webhook', () => {
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'generated' }), null)
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'posted' }), 'ENVIADO')
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'received' }), 'ENVIADO')
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'paused' }), 'ENVIADO')
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'generated', posted_at: '2026-08-23T12:00:00Z' }), 'ENVIADO')
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'delivered' }), 'ENTREGUE')
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'posted', delivered_at: '2026-08-24T12:00:00Z' }), 'ENTREGUE')
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'generated' }, 'order.posted'), 'ENVIADO')
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'posted' }, 'order.delivered'), 'ENTREGUE')
  assert.equal(
    statusPedidoDoEnvioRemoto(
      { status: 'posted', posted_at: '2026-08-23T12:00:00Z', canceled_at: '2026-08-23T12:05:00Z' },
    ),
    null,
  )
  assert.equal(statusPedidoDoEnvioRemoto({ status: 'posted' }, 'order.cancelled'), null)
})

test('cotação exclui serviços que exigem integração adicional', () => {
  assert.equal(servicoCompativelComFluxo({ id: 1, companyId: 1 }), true)
  assert.equal(servicoCompativelComFluxo({ id: 3, companyId: 2 }), true)
  assert.equal(servicoCompativelComFluxo({ id: 12 }), false)
  assert.equal(servicoCompativelComFluxo({ id: 15 }), false)
  assert.equal(servicoCompativelComFluxo({ id: 22 }), false)
  assert.equal(servicoCompativelComFluxo({ id: 999, companyId: 9 }), false)
  assert.equal(servicoCorreiosHabilitado({ id: 1, companyId: 1 }), true)
  assert.equal(servicoCorreiosHabilitado({ id: 2, companyId: 1 }), true)
  assert.equal(servicoCorreiosHabilitado({ id: 33, companyId: 3 }), false)
  assert.equal(servicoCorreiosHabilitado({ id: 1, companyId: 3 }), false)
})

test('cotação solicita somente PAC/SEDEX e mantém preço/prazo customizados', async () => {
  const fetchOriginal = globalThis.fetch
  const tokenOriginal = process.env.MELHOR_ENVIO_TOKEN
  const cepOriginal = process.env.MELHOR_ENVIO_CEP_ORIGEM
  process.env.MELHOR_ENVIO_TOKEN = 'token-de-teste'
  process.env.MELHOR_ENVIO_CEP_ORIGEM = '13000000'
  let servicosRequisitados: unknown
  globalThis.fetch = async (_input, init) => {
    const requisicao = JSON.parse(String(init?.body)) as Record<string, unknown>
    servicosRequisitados = requisicao.services
    return new Response(JSON.stringify([
      {
        id: 1,
        name: 'PAC',
        company: { id: 1, name: 'Correios' },
        price: '10.00',
        custom_price: '8.75',
        delivery_time: 4,
        custom_delivery_time: 6,
      },
      {
        id: 2,
        name: 'SEDEX',
        company: { id: 1, name: 'Correios' },
        price: '11.50',
        custom_price: null,
        delivery_time: 3,
        custom_delivery_time: null,
      },
      {
        id: 33,
        name: 'Standard',
        company: { id: 3, name: 'J&T Express' },
        price: '5.00',
        delivery_time: 1,
      },
    ]), { status: 200 })
  }

  try {
    const cotacoes = await cotarMelhorEnvio({
      cepDestino: '01310100',
      dimensoes: { peso: 0.1, altura: 2, largura: 11, comprimento: 16 },
      valorTotal: 0.95,
    })
    assert.equal(servicosRequisitados, SERVICOS_CORREIOS_LOJA.join(','))
    assert.deepEqual(cotacoes.map(({ id, price, deliveryTime }) => ({ id, price, deliveryTime })), [
      { id: 1, price: 8.75, deliveryTime: 6 },
      { id: 2, price: 11.5, deliveryTime: 3 },
    ])
  } finally {
    globalThis.fetch = fetchOriginal
    if (tokenOriginal === undefined) delete process.env.MELHOR_ENVIO_TOKEN
    else process.env.MELHOR_ENVIO_TOKEN = tokenOriginal
    if (cepOriginal === undefined) delete process.env.MELHOR_ENVIO_CEP_ORIGEM
    else process.env.MELHOR_ENVIO_CEP_ORIGEM = cepOriginal
  }
})

test('produtos e seguro do Melhor Envio refletem o desconto Pix até o centavo', () => {
  assert.deepEqual(calcularMercadoriasLiquidas({
    produtos: [{ nome: 'Produto teste', quantidade: 1, valorUnitario: 1 }],
    subtotal: 1,
    desconto: 0.05,
  }), {
    produtos: [{ nome: 'Produto teste', quantidade: 1, valorUnitario: 0.95 }],
    valorTotal: 0.95,
  })

  const rateio = calcularMercadoriasLiquidas({
    produtos: [
      { nome: 'A', quantidade: 2, valorUnitario: 10 },
      { nome: 'B', quantidade: 1, valorUnitario: 5 },
    ],
    subtotal: 25,
    desconto: 1,
  })
  const soma = rateio.produtos.reduce(
    (total, produto) => total + produto.quantidade * produto.valorUnitario,
    0,
  )
  assert.equal(Number(soma.toFixed(2)), 24)
  assert.equal(rateio.valorTotal, 24)

  const minimoPorUnidade = calcularMercadoriasLiquidas({
    produtos: [
      { nome: 'Barato', quantidade: 1, valorUnitario: 0.01 },
      { nome: 'Caro', quantidade: 1, valorUnitario: 9.99 },
    ],
    subtotal: 10,
    desconto: 9.98,
  })
  assert.deepEqual(minimoPorUnidade.produtos, [
    { nome: 'Barato', quantidade: 1, valorUnitario: 0.01 },
    { nome: 'Caro', quantidade: 1, valorUnitario: 0.01 },
  ])
  assert.throws(() => calcularMercadoriasLiquidas({
    produtos: [{ nome: 'A', quantidade: 1, valorUnitario: 1 }],
    subtotal: 0.99,
    desconto: 0,
  }), /Subtotal do pedido diverge/)
  assert.throws(() => calcularMercadoriasLiquidas({
    produtos: [{ nome: 'A', quantidade: 1, valorUnitario: 1 }],
    subtotal: 1,
    desconto: Number.NaN,
  }), /Subtotal ou desconto inválido/)
})

test('NF-e exige 44 dígitos e dígito verificador válido', () => {
  const chave = chaveNfeFixture()
  assert.equal(chaveNfeValida(chave), true)
  assert.equal(exigirChaveNfe(chave.replace(/(\d{4})/g, '$1 ')), chave)
  assert.equal(chaveNfeValida(`${chave.slice(0, 43)}${Number(chave[43]) === 9 ? 0 : Number(chave[43]) + 1}`), false)
  assert.throws(() => exigirChaveNfe('1'.repeat(44)), /chave NF-e válida/)
  assert.equal(exigirInscricaoEstadual('122.024.604.117'), '122024604117')
  assert.throws(() => exigirInscricaoEstadual('ISENTO'), /INSCRICAO_ESTADUAL/)
})

test('assinatura do Melhor Envio usa HMAC SHA-256 do corpo bruto em base64', () => {
  const corpo = JSON.stringify({ event: 'order.posted', data: { id: 'x' } })
  const segredo = 'segredo-fixture'
  const assinatura = createHmac('sha256', segredo).update(corpo).digest('base64')
  assert.equal(assinaturaWebhookMelhorEnvioValida(corpo, assinatura, segredo), true)
  assert.equal(assinaturaWebhookMelhorEnvioValida(`${corpo} `, assinatura, segredo), false)
  assert.equal(assinaturaWebhookMelhorEnvioValida(corpo, '', segredo), false)
})

test('lease impede execução concorrente e é liberado quando a operação falha', async () => {
  let ocupado = false
  const liberados: string[] = []
  const adquirir = async () => {
    if (ocupado) return null
    ocupado = true
    return 'lease-1'
  }
  const liberar = async (token: string) => {
    liberados.push(token)
    ocupado = false
  }

  const primeiro = executarComLease({
    adquirir,
    liberar,
    executar: async () => {
      const concorrente = await executarComLease({ adquirir, liberar, executar: async () => 'indevido' })
      assert.deepEqual(concorrente, { adquirido: false })
      return 'ok'
    },
  })
  assert.deepEqual(await primeiro, { adquirido: true, valor: 'ok' })

  ocupado = false
  await assert.rejects(
    executarComLease({ adquirir, liberar, executar: async () => { throw new Error('falha externa') } }),
    /falha externa/,
  )
  assert.deepEqual(liberados, ['lease-1'])
})

test('rastreamento exige segundo fator e mantém lista positiva sem dados pessoais', () => {
  assert.equal(
    verificacaoRastreioConfere(['Cliente@Example.com', '529.982.247-25'], 'cliente@example.com'),
    true,
  )
  assert.equal(verificacaoRastreioConfere(['529.982.247-25'], '111.111.111-11'), false)

  const resposta = respostaMinimaRastreio({
    orderNumber: 'FM-2026-0001',
    status: 'ENVIADO',
    createdAt: new Date('2026-08-10T12:00:00Z'),
    freteServico: '1',
    freteTransportadora: 'Correios',
    fretePrazo: 3,
    trackingCode: 'QA123BR',
    tracking: [],
  })
  assert.deepEqual(Object.keys(resposta).sort(), [
    'createdAt', 'fretePrazo', 'freteServico', 'freteTransportadora',
    'orderNumber', 'status', 'tracking', 'trackingCode',
  ].sort())
})
