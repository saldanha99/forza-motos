import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  classificarCarrinhoEventoPirelli,
  type EventoPirelliCheckout,
  type ItemCarrinhoEventoPirelli,
  vendasEventoPirelliDisponiveis,
} from '../lib/checkout/catalogo-evento-pirelli'
import { resumirPreVenda } from '../lib/checkout/prevenda'
import { itensParaVerificarNoTiny } from '../lib/checkout/estoque-webhook'
import { opcaoRetirada, somarPrazoDisponibilidade } from '../lib/frete/cotar'
import { htmlPedidoConfirmado } from '../lib/email/templates'
import { msgPedidoConfirmado } from '../lib/evolution/templates'
import { validarProdutoEventoCompleto } from '../app/api/admin/evento-pirelli/produtos/validacao'
import {
  checkoutCanecaEventoSchema,
  SKU_CANECA_EVENTO_PIRELLI,
  vendasEventoPirelliAbertas,
} from '../lib/checkout/caneca-evento-pirelli'
import {
  atingiuValorMinimoPneus,
  categoriaContaComoPneu,
  subtotalPneusDoPedido,
} from '../lib/checkout/beneficios-evento-pirelli'
import { eventoDisponivel, inscricaoEventoPirelliDisponivel } from '../lib/evento-pirelli'

const agora = new Date('2026-08-11T15:00:00.000Z')
const evento: EventoPirelliCheckout = {
  id: 'evento-1',
  titulo: 'Pirelli no Rodeo',
  ativo: true,
  publicado: true,
  vendasAntecipadasAbertas: false,
  dataInicio: new Date('2026-08-01T00:00:00.000Z'),
  dataFim: new Date('2026-09-01T00:00:00.000Z'),
}

function itemEvento(
  productId: string,
  quantidade = 1,
  alteracoes: Partial<ItemCarrinhoEventoPirelli['produto']> = {},
): ItemCarrinhoEventoPirelli {
  return {
    productId,
    quantidade,
    produto: {
      preVenda: true,
      prazoEntregaDias: 15,
      eventoPirelliId: evento.id,
      limitePorPedidoEvento: 3,
      eventoPirelli: evento,
      ...alteracoes,
    },
  }
}

test('carrinho deriva a campanha do banco e rejeita mistura com catálogo normal', () => {
  assert.deepEqual(classificarCarrinhoEventoPirelli([itemEvento('p1'), itemEvento('p2')], agora), {
    eventoId: evento.id,
    evento,
  })
  assert.equal(classificarCarrinhoEventoPirelli([
    itemEvento('normal', 1, {
      eventoPirelliId: null,
      eventoPirelli: null,
      preVenda: false,
      prazoEntregaDias: null,
      limitePorPedidoEvento: null,
    }),
  ], agora), null)
  assert.throws(
    () => classificarCarrinhoEventoPirelli([
      itemEvento('p1'),
      itemEvento('normal', 1, { eventoPirelliId: null, eventoPirelli: null }),
    ], agora),
    /CARRINHO_EVENTO_MISTO/,
  )
})

test('campanha exige publicação, janela ativa, pré-venda válida e limite por pedido', () => {
  assert.throws(
    () => classificarCarrinhoEventoPirelli([
      itemEvento('p1', 1, { eventoPirelli: { ...evento, publicado: false } }),
    ], agora),
    /EVENTO_PIRELLI_INDISPONIVEL/,
  )
  assert.throws(
    () => classificarCarrinhoEventoPirelli([
      itemEvento('p1', 1, { eventoPirelli: { ...evento, dataFim: new Date('2026-08-10T00:00:00Z') } }),
    ], agora),
    /EVENTO_PIRELLI_FORA_DA_JANELA/,
  )
  assert.throws(
    () => classificarCarrinhoEventoPirelli([itemEvento('p1', 4)], agora),
    /LIMITE_PRODUTO_EVENTO_EXCEDIDO/,
  )
  assert.throws(
    () => classificarCarrinhoEventoPirelli([
      itemEvento('p1', 1, { preVenda: false, prazoEntregaDias: null }),
    ], agora),
    /PRODUTO_EVENTO_INVALIDO/,
  )
})

test('chaves operacionais liberam experiências e vendas antes da data sem ignorar invariantes', () => {
  const agoraJanela = new Date('2026-08-22T15:00:00.000Z')
  const inicioFuturo = new Date('2026-09-05T14:00:00.000Z')
  const fimFuturo = new Date('2026-09-07T02:59:59.999Z')
  const fimPassado = new Date('2026-08-21T23:59:59.999Z')
  const experienciaAberta = {
    ativo: true,
    publicado: true,
    inscricoesAntecipadasAbertas: true,
    dataInicio: inicioFuturo,
    dataFim: fimFuturo,
  }

  assert.equal(inscricaoEventoPirelliDisponivel(experienciaAberta, agoraJanela), true)
  assert.equal(eventoDisponivel(experienciaAberta, agoraJanela), true)
  assert.equal(inscricaoEventoPirelliDisponivel({
    ...experienciaAberta,
    inscricoesAntecipadasAbertas: false,
  }, agoraJanela), false)
  assert.equal(eventoDisponivel({
    ...experienciaAberta,
    inscricoesAntecipadasAbertas: false,
  }, agoraJanela), false)
  assert.equal(eventoDisponivel({
    ...experienciaAberta,
    dataFim: fimPassado,
  }, agoraJanela), false)
  assert.equal(eventoDisponivel({
    ...experienciaAberta,
    ativo: false,
  }, agoraJanela), false)
  assert.equal(eventoDisponivel({
    ...experienciaAberta,
    publicado: false,
  }, agoraJanela), false)
  assert.equal(eventoDisponivel({
    ...experienciaAberta,
    inscricoesAntecipadasAbertas: false,
    dataInicio: agoraJanela,
  }, agoraJanela), true)

  const eventoFuturo = { ...evento, dataInicio: inicioFuturo, dataFim: fimFuturo }
  assert.throws(
    () => classificarCarrinhoEventoPirelli([
      itemEvento('p1', 1, { eventoPirelli: eventoFuturo }),
    ], agoraJanela),
    /EVENTO_PIRELLI_FORA_DA_JANELA/,
  )
  assert.doesNotThrow(() => classificarCarrinhoEventoPirelli([
    itemEvento('p1', 1, {
      eventoPirelli: { ...eventoFuturo, vendasAntecipadasAbertas: true },
    }),
  ], agoraJanela))
  assert.equal(
    vendasEventoPirelliDisponiveis({
      ...eventoFuturo,
      vendasAntecipadasAbertas: true,
    }, agoraJanela),
    true,
  )
  assert.throws(
    () => classificarCarrinhoEventoPirelli([
      itemEvento('p1', 1, {
        eventoPirelli: {
          ...eventoFuturo,
          vendasAntecipadasAbertas: true,
          dataFim: fimPassado,
        },
      }),
    ], agoraJanela),
    /EVENTO_PIRELLI_FORA_DA_JANELA/,
  )
  assert.equal(
    vendasEventoPirelliDisponiveis({
      ...eventoFuturo,
      vendasAntecipadasAbertas: true,
      dataFim: fimPassado,
    }, agoraJanela),
    false,
  )
})

test('landing e APIs usam a mesma abertura e não exibem linguagem de cadastro antecipado', () => {
  const pagina = readFileSync('app/evento-pirelli/page.tsx', 'utf8')
  const conteudo = readFileSync('app/evento-pirelli/_components/ConteudoEventoPirelli.tsx', 'utf8')
  const quiz = readFileSync('app/api/evento-pirelli/quiz/route.ts', 'utf8')
  const participacoes = readFileSync('app/api/evento-pirelli/participacoes/route.ts', 'utf8')
  const landing = readFileSync('components/evento-pirelli/EventoPirelliLanding.tsx', 'utf8')
  const admin = readFileSync('components/evento-pirelli/AdminEventoPirelli.tsx', 'utf8')

  assert.match(pagina, /<ConteudoEventoPirelli pagina="landing"/)
  assert.match(conteudo, /const experienciasDisponiveis = eventoDisponivel\(evento\)/)
  assert.equal(quiz.match(/eventoDisponivel\(visitante\.evento\)/g)?.length, 2)
  assert.match(participacoes, /eventoDisponivel\(visitante\.evento\)/)
  assert.doesNotMatch(landing, /cadastro antecipado/i)
  assert.doesNotMatch(admin, /cadastro antecipado/i)
  assert.match(admin, /Experiências abertas agora/)
  assert.match(admin, /Banner principal — um único QR Code/)
  assert.match(admin, /banner-principal-evento-pirelli-A2-300dpi\.pdf/)
  assert.match(admin, /forzamotos\.com\.br\/evento-pirelli/)
  assert.match(landing, /vinculado com segurança ao WhatsApp cadastrado/)
})

test('cadastro administrativo usa allowlist e exige uma oferta comercial válida', () => {
  const entrada = {
    nome: 'Pneu Pirelli do evento',
    sku: ' pirelli-evento-001 ',
    descricao: 'Produto sob encomenda, enviado ou retirado depois do evento.',
    categoria: 'Pneus',
    marca: 'Pirelli',
    preco: 1_000,
    precoPromocional: 899,
    prazoEntregaDias: 15,
    peso: 7.5,
    altura: 70,
    largura: 70,
    comprimento: 20,
    imagens: ['/imagens/evento-pirelli-produtos/pneu.webp'],
    ativo: true,
    destaque: true,
    ordemEvento: 1,
    limitePorPedidoEvento: 4,
  }
  assert.equal(validarProdutoEventoCompleto(entrada).sku, 'PIRELLI-EVENTO-001')
  assert.throws(
    () => validarProdutoEventoCompleto({ ...entrada, precoPromocional: 1_000 }),
    /preço especial/i,
  )
  assert.throws(
    () => validarProdutoEventoCompleto({ ...entrada, imagens: [] }),
    /imagem/i,
  )
  assert.throws(
    () => validarProdutoEventoCompleto({ ...entrada, eventoPirelliId: 'forjado-pelo-browser' }),
  )
})

test('frete soma o maior prazo da pré-venda e retirada deixa de prometer atendimento imediato', () => {
  const resumo = resumirPreVenda([
    { preVenda: true, prazoEntregaDias: 8 },
    { preVenda: true, prazoEntregaDias: 15 },
    { preVenda: false, prazoEntregaDias: 90 },
  ])
  assert.deepEqual(resumo, { preVenda: true, prazoMaximoDias: 15 })

  const [frete] = somarPrazoDisponibilidade([{
    id: 'pac',
    nome: 'PAC',
    transportadora: 'Correios',
    preco: 20,
    prazo: 5,
    fonte: 'fallback',
  }], 15)
  assert.equal(frete.prazo, 20)
  assert.equal(frete.prazoTransporte, 5)
  assert.equal(frete.prazoDisponibilidade, 15)

  const retirada = opcaoRetirada(15)
  assert.equal(retirada.prazo, 15)
  assert.match(retirada.nome, /após disponibilidade/)
})

test('confirmação de estoque usa o snapshot do pedido, não o cadastro atual', () => {
  assert.deepEqual(itensParaVerificarNoTiny([
    { productId: 'prevenda', quantidade: 1, estoqueReservado: false, preVendaSnapshot: true },
    { productId: 'fisico', quantidade: 2, estoqueReservado: true, preVendaSnapshot: false },
    { productId: 'legado', quantidade: 1, estoqueReservado: true, preVendaSnapshot: true },
  ]), [{ productId: 'fisico', quantidade: 2 }])
})

test('e-mail e WhatsApp de pré-venda informam indisponibilidade e prazo sem prometer separação', () => {
  const email = htmlPedidoConfirmado({
    nomeCliente: 'Cliente',
    numeroPedido: 'FM-2026-0001',
    itens: [{
      nome: 'Pneu Pirelli',
      quantidade: 1,
      precoUnitario: 499,
      preVenda: true,
      prazoEntregaDias: 15,
    }],
    subtotal: 499,
    frete: 0,
    total: 499,
    preVenda: true,
    prazoPreVendaDias: 15,
    prazoTotalDias: 20,
    fretePrazo: 20,
    retirada: true,
    nomeCampanha: evento.titulo,
  })
  assert.match(email, /não está disponível para envio ou retirada imediata/)
  assert.match(email, /15 dias úteis/)
  assert.match(email, /Aguarde nosso aviso de pedido pronto/)
  assert.doesNotMatch(email, /já estamos separando seu pedido/)

  const whatsapp = msgPedidoConfirmado('Cliente', 'FM-2026-0001', {
    preVenda: true,
    prazoPreVendaDias: 15,
    prazoTotalDias: 20,
    retirada: true,
    nomeCampanha: evento.titulo,
  })
  assert.match(whatsapp, /não estão disponíveis para envio ou retirada imediata/)
  assert.match(whatsapp, /15 dias úteis/)
  assert.match(whatsapp, /Aguarde nosso aviso/)
  assert.doesNotMatch(whatsapp, /Estamos separando/)
})

test('checkout persiste origem/snapshots, bloqueia cupom e detecta corrida de preço', () => {
  const pedido = readFileSync('lib/checkout/pedido.ts', 'utf8')
  const rota = readFileSync('app/api/pedidos/route.ts', 'utf8')
  const checkout = readFileSync('app/(store)/checkout/page.tsx', 'utf8')
  const detalheProduto = readFileSync('app/(store)/produtos/[slug]/page.tsx', 'utf8')

  assert.match(pedido, /classificarCarrinhoEventoPirelli\(items\)/)
  assert.match(pedido, /canal: campanhaAtual \? 'EVENTO_PIRELLI' : 'ECOMMERCE'/)
  assert.match(pedido, /eventoPirelliId: campanhaAtual\?\.eventoId/)
  assert.match(pedido, /eventoPirelliVisitanteId: visitanteAtual\?\.id/)
  assert.match(pedido, /eventoId_whatsapp:/)
  assert.match(pedido, /chaveSubmissao: `checkout:\$\{checkoutTentativaId\}`/)
  assert.match(pedido, /preVendaSnapshot: produtoAtual\.preVenda/)
  assert.match(pedido, /prazoEntregaDiasSnapshot:/)
  assert.match(pedido, /CUPOM_EVENTO_NAO_PERMITIDO/)
  assert.match(pedido, /Math\.round\(precoAtual \* 100\)[\s\S]*item\.precoUnitario/)
  assert.match(rota, /CARRINHO_PRECO_ATUALIZADO/)
  assert.match(rota, /CUPOM_EVENTO_NAO_PERMITIDO/)
  assert.match(rota, /WHATSAPP_EVENTO_PIRELLI_OBRIGATORIO/)
  assert.doesNotMatch(checkout, /eventoPirelliCodigoQr/)
  assert.match(detalheProduto, /vendasAntecipadasAbertas: true/)
  assert.match(detalheProduto, /vendasEventoPirelliDisponiveis/)
  assert.match(
    detalheProduto,
    /where: \{ slug: params\.slug, ativo: true, ocultoManual: false \}/,
  )
})

test('QR de ofertas abre a vitrine sem cadastro e coleta os dados somente no checkout', () => {
  const landing = readFileSync('components/evento-pirelli/EventoPirelliLanding.tsx', 'utf8')
  const checkout = readFileSync('app/(store)/checkout/page.tsx', 'utf8')
  const pedido = readFileSync('lib/checkout/pedido.ts', 'utf8')

  assert.match(landing, /<OfertasEvento produtos=\{produtos\}/)
  assert.doesNotMatch(landing, /\{codigo \? <OfertasEvento/)
  assert.match(landing, /Ver produtos sem cadastro/)
  assert.match(checkout, /WhatsApp \*/)
  assert.doesNotMatch(checkout, /eventoPirelliCodigoQr/)
  assert.match(pedido, /eventoPirelliVisitante\.upsert/)
  assert.match(pedido, /WHATSAPP_EVENTO_PIRELLI_OBRIGATORIO/)
})

test('pré-venda não replica automaticamente no Olist, mas mantém ação manual', () => {
  const efeitos = readFileSync('lib/checkout/efeitos-pedido-confirmado.ts', 'utf8')
  const sync = readFileSync('lib/olist/sync-orders.ts', 'utf8')
  const manual = readFileSync('app/api/admin/pedidos/[id]/replicar-olist/route.ts', 'utf8')

  assert.match(efeitos, /pedidoEventoPirelli && !order\.olistOrderId/)
  assert.match(efeitos, /EFEITO:OLIST_ADIADO_EVENTO/)
  assert.match(sync, /eventoPirelliId: null/)
  assert.match(sync, /canal: \{ not: 'EVENTO_PIRELLI' \}/)
  assert.match(manual, /await replicarPedidoOlist\(order\.id,\s*\{/)
  assert.match(manual, /confirmarNovaInclusao: body\.confirmarNovaInclusao === true/)
  assert.doesNotMatch(manual, /eventoPirelliId.*409/)
})

test('prévia de frete usa os itens e endpoints genéricos não alteram oferta exclusiva', () => {
  const calculador = readFileSync('components/store/CalculadorFrete.tsx', 'utf8')
  const produto = readFileSync('app/api/produtos/[id]/route.ts', 'utf8')
  const foto = readFileSync('app/api/admin/produtos/[id]/foto/route.ts', 'utf8')
  const sync = readFileSync('app/api/admin/produtos/[id]/sync/route.ts', 'utf8')

  assert.match(calculador, /fetch\('\/api\/frete\/cotar'/)
  assert.match(calculador, /Retirada após disponibilidade/)
  for (const arquivo of [produto, foto, sync]) {
    assert.match(arquivo, /eventoPirelliId/)
    assert.match(arquivo, /status: 409/)
  }
  assert.ok(
    foto.indexOf('if (current.eventoPirelliId)') < foto.indexOf("await put(filename, file"),
    'foto de produto do evento deve ser bloqueada antes do upload no Blob',
  )
})

test('checkout próprio da caneca usa payload fechado, CPF válido e abertura antes da data explícita', () => {
  const entrada = {
    codigoQr: 'abcdefghijklmnopqrstuvwx12345678',
    email: 'CLIENTE@EXEMPLO.COM',
    cpf: '529.982.247-25',
    nomeGravacao: 'Maria',
    quantidade: 2,
    checkoutTentativaId: '123e4567-e89b-42d3-a456-426614174000',
  }
  assert.deepEqual(checkoutCanecaEventoSchema.parse(entrada), {
    ...entrada,
    email: 'cliente@exemplo.com',
    cpf: '52998224725',
  })
  assert.throws(() => checkoutCanecaEventoSchema.parse({ ...entrada, total: 0.01 }))
  assert.throws(() => checkoutCanecaEventoSchema.parse({ ...entrada, cpf: '111.111.111-11' }))
  assert.throws(() => checkoutCanecaEventoSchema.parse({ ...entrada, quantidade: 11 }))

  const futuro = new Date('2026-09-05T14:00:00.000Z')
  assert.equal(vendasEventoPirelliAbertas({
    ativo: true,
    publicado: true,
    vendasAntecipadasAbertas: true,
    dataInicio: futuro,
    dataFim: new Date('2026-09-07T02:59:59.999Z'),
  }, agora), true)
  assert.equal(vendasEventoPirelliAbertas({
    ativo: true,
    publicado: true,
    vendasAntecipadasAbertas: false,
    dataInicio: futuro,
    dataFim: new Date('2026-09-07T02:59:59.999Z'),
  }, agora), false)
})

test('admin sincroniza o preço técnico da caneca com o evento no mesmo commit', () => {
  const rotaAdmin = readFileSync('app/api/admin/evento-pirelli/route.ts', 'utf8')

  assert.match(rotaAdmin, /valorCaneca <= 0/)
  assert.match(rotaAdmin, /prisma\.\$transaction\(async \(tx\) =>/)
  assert.match(rotaAdmin, /tx\.eventoPirelli\.update/)
  assert.match(rotaAdmin, /tx\.product\.updateMany/)
  assert.match(rotaAdmin, /sku: SKU_CANECA_EVENTO_PIRELLI/)
  assert.match(rotaAdmin, /preco: atualizado\.valorCanecaAvulsa/)
  assert.match(rotaAdmin, /precoPromocional: atualizado\.valorCanecaAvulsa/)
  assert.match(rotaAdmin, /ocultoManual: true/)
})

test('benefício automático soma somente pneus e a caneca nunca financia o próprio brinde', () => {
  assert.equal(categoriaContaComoPneu('Pneus'), true)
  assert.equal(categoriaContaComoPneu('Pneu para moto'), true)
  assert.equal(categoriaContaComoPneu('Canecas'), false)
  const subtotal = subtotalPneusDoPedido([
    {
      quantidade: 1,
      precoUnitario: 900,
      product: { sku: 'PNEU-001', categoria: 'Pneus' },
    },
    {
      quantidade: 5,
      precoUnitario: 135,
      // A exclusão por SKU continua valendo mesmo se a categoria for
      // corrompida acidentalmente para "Pneus" no cadastro técnico.
      product: { sku: SKU_CANECA_EVENTO_PIRELLI, categoria: 'Pneus' },
    },
    {
      quantidade: 2,
      precoUnitario: 500,
      product: { sku: 'OLEO-001', categoria: 'Lubrificantes' },
    },
  ])
  assert.equal(subtotal.toNumber(), 900)
  assert.equal(atingiuValorMinimoPneus(subtotal, 899, 'MAIOR_QUE'), true)
  assert.equal(atingiuValorMinimoPneus(899, 899, 'MAIOR_QUE'), false)
  assert.equal(atingiuValorMinimoPneus(899, 899, 'MAIOR_OU_IGUAL'), true)
})

test('checkout técnico da caneca fica oculto, vincula o acesso ao pedido e materializa compra no webhook', () => {
  const checkout = readFileSync('lib/checkout/caneca-evento-pirelli.ts', 'utf8')
  const rota = readFileSync('app/api/evento-pirelli/caneca/checkout/route.ts', 'utf8')
  const webhook = readFileSync('lib/checkout/webhook-pagamento.ts', 'utf8')
  const beneficios = readFileSync('lib/checkout/beneficios-evento-pirelli.ts', 'utf8')

  assert.match(rota, /x-idempotency-key/)
  assert.match(checkout, /ocultoManual: true/)
  assert.match(checkout, /preVenda: true/)
  assert.match(checkout, /estoque: 0/)
  assert.match(checkout, /eventoPirelliVisitanteId: atual\.id/)
  assert.match(checkout, /canal: 'EVENTO_PIRELLI'/)
  assert.match(checkout, /\/evento-pirelli\/caneca\/sucesso\?token=/)
  assert.match(webhook, /aplicarBeneficiosPedidoPirelliPago\(tx, orderId, \{/)
  assert.match(beneficios, /eventoPirelliCompraCaneca\.upsert/)
  assert.match(beneficios, /origem: 'COMPRA_PNEUS'/)
})

test('cancelamento pago reverte caneca e benefício de pneus atomicamente sem apagar outras origens', () => {
  const beneficios = readFileSync('lib/checkout/beneficios-evento-pirelli.ts', 'utf8')
  const pagamento = readFileSync('lib/checkout/pagamento.ts', 'utf8')
  const webhook = readFileSync('app/api/mercadopago/webhook/route.ts', 'utf8')

  assert.match(beneficios, /eventoPirelliCompraCaneca\.updateMany[\s\S]*status: 'CANCELADA'/)
  assert.match(beneficios, /origem: 'COMPRA_PNEUS'/)
  assert.match(beneficios, /elegibilidade\.referenciaVenda !== pedido\.orderNumber/)
  assert.match(beneficios, /revogadoEm: new Date\(\)/)
  assert.match(beneficios, /revogadoPor: contexto\.por/)
  assert.match(beneficios, /revogadoEm: null/)
  assert.match(beneficios, /if \(outrasOrigens === 0\)/)

  assert.match(pagamento, /prisma\.\$transaction[\s\S]*reverterBeneficiosPedidoPirelliCancelado\(tx, orderId/)
  assert.match(webhook, /prisma\.\$transaction[\s\S]*reverterBeneficiosPedidoPirelliCancelado\(tx, orderId/)
})

test('confirmações da caneca usam link seguro sem depender de QR operacional', () => {
  const link = 'https://forzamotos.com.br/evento-pirelli/caneca/confirmar?token=seguro'
  const whatsapp = msgPedidoConfirmado('Maria', 'FM-2026-0001', {
    canecaEventoPirelli: true,
    nomeGravacao: 'Maria',
    quantidadeCanecas: 2,
    preVenda: true,
    linkConfirmacaoCaneca: link,
  })
  assert.match(whatsapp, /pagamento da sua caneca foi aprovado/i)
  assert.match(whatsapp, /vinculada ao seu cadastro/i)
  assert.match(whatsapp, /caneca\/confirmar\?token=seguro/)
  assert.doesNotMatch(whatsapp, /apresente.*QR/i)
  assert.match(whatsapp, /2 canecas/i)
  assert.doesNotMatch(whatsapp, /produtos não estão disponíveis/i)

  const email = htmlPedidoConfirmado({
    nomeCliente: 'Maria',
    numeroPedido: 'FM-2026-0001',
    itens: [{
      nome: 'Caneca personalizada — Evento Pirelli',
      quantidade: 2,
      precoUnitario: 135,
      preVenda: true,
      prazoEntregaDias: 1,
    }],
    subtotal: 270,
    frete: 0,
    total: 270,
    canecaEventoPirelli: true,
    nomeGravacao: 'Maria',
    quantidadeCanecas: 2,
    linkConfirmacaoCaneca: link,
  })
  assert.match(email, /Caneca Confirmada!/)
  assert.match(email, /Caneca vinculada ao seu cadastro/)
  assert.match(email, /caneca\/confirmar\?token=seguro/)
  assert.match(email, /Nome para gravação: <strong>Maria<\/strong>/)
  assert.doesNotMatch(email, /Estamos separando e embalando/)
})
