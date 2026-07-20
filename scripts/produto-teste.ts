/**
 * Produto teste de R$ 1,00 para validar o fluxo completo do e-commerce em
 * produção (carrinho → frete → Mercado Pago → notificações → baixa de estoque).
 *
 * Uso na VPS (dentro do container do app, que já tem DATABASE_URL):
 *   docker exec forza-app npx tsx scripts/produto-teste.ts criar
 *   docker exec forza-app npx tsx scripts/produto-teste.ts remover
 *
 * O produto NÃO tem tinyId — a sincronização com o Olist ignora ele.
 * Após o teste, rode "remover" para tirá-lo da loja.
 */
import { prisma } from '../lib/prisma'

const SKU = 'TESTE-FLUXO-R1'

async function criar() {
  const produto = await prisma.product.upsert({
    where: { sku: SKU },
    update: { ativo: true, estoque: 10, preco: 1 },
    create: {
      sku: SKU,
      nome: 'Produto Teste — Validação de Checkout (R$ 1)',
      slug: 'produto-teste-validacao-checkout',
      descricao:
        'Produto interno para validação do fluxo de compra em produção. Não é um produto real — pedidos deste item não serão enviados.',
      preco: 1,
      estoque: 10,
      categoria: 'Teste',
      marca: 'Forza',
      ativo: true,
      temImagem: true, // passa no filtro da vitrine mesmo sem foto real
      imagens: [],
      peso: 0.1,
      altura: 5,
      largura: 10,
      comprimento: 10,
    },
  })
  console.log(`✅ Produto teste criado/reativado: /produtos/${produto.slug} (R$ 1,00, estoque 10)`)
}

async function remover() {
  const r = await prisma.product.updateMany({
    where: { sku: SKU },
    data: { ativo: false, ocultoManual: true },
  })
  console.log(r.count > 0 ? '✅ Produto teste desativado e oculto da loja.' : 'ℹ️ Produto teste não encontrado.')
}

const acao = process.argv[2]
const run = acao === 'criar' ? criar : acao === 'remover' ? remover : null
if (!run) {
  console.log('Uso: npx tsx scripts/produto-teste.ts <criar|remover>')
  process.exit(1)
}

run()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
