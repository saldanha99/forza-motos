import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PRODUTO_ID = 'e2e-product-payment-20260810'
const EVENTO_ID = 'e2e-event-payment-20260810'

function validarBancoIsolado() {
  const databaseUrl = process.env.DATABASE_URL
  const esperado = process.env.E2E_FIXTURE_DB
  if (!databaseUrl || !esperado) throw new Error('DATABASE_URL e E2E_FIXTURE_DB são obrigatórios')

  const banco = new URL(databaseUrl).pathname.replace(/^\//, '')
  if (banco !== esperado || !/^forzamotos_codex_e2e_[a-z0-9_]+$/i.test(banco)) {
    throw new Error(`Seed E2E recusado para o banco ${banco || '(vazio)'}`)
  }
}

async function main() {
  validarBancoIsolado()

  const [pedidos, inscricoes] = await Promise.all([
    prisma.orderItem.count({ where: { productId: PRODUTO_ID } }),
    prisma.eventoInscricao.count({ where: { eventoId: EVENTO_ID } }),
  ])
  if (pedidos || inscricoes) {
    throw new Error('Fixtures E2E já possuem transações; use um banco isolado novo')
  }

  const produto = await prisma.product.upsert({
    where: { id: PRODUTO_ID },
    update: {
      preco: 10,
      estoque: 5,
      estoqueReservado: 0,
      ativo: true,
      ocultoManual: false,
    },
    create: {
      id: PRODUTO_ID,
      sku: 'E2E-PAYMENT-20260810',
      nome: 'Pneu Pirelli E2E 150/70 R17',
      slug: 'e2e-pneu-pirelli-pagamento',
      descricao: 'Produto isolado para validar o fluxo de pagamento da Forza Motos.',
      preco: 10,
      estoque: 5,
      categoria: 'Pneus',
      marca: 'Pirelli',
      imagens: ['/images/evento-pirelli/rodeo-hero.webp'],
      imagensVerificadas: true,
      temImagem: true,
      ativo: true,
      peso: 5,
      altura: 15,
      largura: 60,
      comprimento: 60,
      medidaLargura: 150,
      medidaPerfil: 70,
      medidaAro: 17,
      medidaConstrucao: 'radial',
    },
  })

  const evento = await prisma.evento.upsert({
    where: { id: EVENTO_ID },
    update: {
      preco: 12,
      vagas: 10,
      ativo: true,
      publicado: true,
      opcoesVaga: [
        { label: 'Só piloto', preco: 12 },
        { label: 'Piloto + garupa', preco: 20 },
      ],
    },
    create: {
      id: EVENTO_ID,
      titulo: 'Passeio Forza E2E — Pagamento Sandbox',
      slug: 'e2e-evento-pago',
      descricao: 'Evento isolado para validar reserva de vagas e pagamento no Mercado Pago.',
      conteudo: 'Fixture E2E. Não corresponde a um evento real.',
      dataInicio: new Date('2026-09-30T12:00:00.000Z'),
      dataFim: new Date('2026-09-30T18:00:00.000Z'),
      local: 'Ambiente de teste Forza',
      endereco: 'VPS isolada',
      imagemUrl: '/images/evento-pirelli/rodeo-hero.webp',
      preco: 12,
      categoria: 'Teste E2E',
      vagas: 10,
      ativo: true,
      publicado: true,
      opcoesVaga: [
        { label: 'Só piloto', preco: 12 },
        { label: 'Piloto + garupa', preco: 20 },
      ],
    },
  })

  const settings = {
    mp_checkout_pro_enabled: 'true',
    mp_accept_cards: 'false',
    mp_accept_ticket: 'false',
    mp_accept_pix: 'false',
    mp_max_installments: '1',
    mp_auto_return: 'approved',
    mp_binary_mode: 'false',
    mp_preference_expiration_minutes: '30',
  }
  await prisma.$transaction(
    Object.entries(settings).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  )

  console.log(JSON.stringify({
    produto: { id: produto.id, slug: produto.slug, preco: Number(produto.preco), estoque: produto.estoque },
    evento: { id: evento.id, slug: evento.slug, preco: Number(evento.preco), vagas: evento.vagas },
  }))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
