import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { gerarSlug } from '@/lib/utils'
import { exigirAdmin, obterEventoPirelli } from '@/lib/evento-pirelli'
import { SKU_CANECA_EVENTO_PIRELLI } from '@/lib/checkout/caneca-evento-pirelli'
import {
  ehErroValidacaoProdutoEvento,
  ErroValidacaoProdutoEvento,
  lerJsonProdutoEvento,
  mensagemErroValidacao,
  serializarProdutoEvento,
  validarProdutoEventoCompleto,
} from './validacao'

export const dynamic = 'force-dynamic'

const SEM_CACHE = { 'Cache-Control': 'no-store, must-revalidate' }

async function slugParaNovoProduto(nome: string, sku: string) {
  const base = gerarSlug(nome)
  if (!base) throw new ErroValidacaoProdutoEvento('O nome precisa conter letras ou números.')
  const existente = await prisma.product.findUnique({ where: { slug: base }, select: { id: true } })
  if (!existente) return base
  const sufixo = gerarSlug(sku)
  return `${base}-${sufixo}`.slice(0, 190)
}

export async function GET() {
  if (!await exigirAdmin()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401, headers: SEM_CACHE })
  }
  const evento = await obterEventoPirelli()
  const produtos = await prisma.product.findMany({
    where: {
      eventoPirelliId: evento.id,
      sku: { not: SKU_CANECA_EVENTO_PIRELLI },
    },
    orderBy: [{ ordemEvento: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ produtos: produtos.map(serializarProdutoEvento) }, { headers: SEM_CACHE })
}

export async function POST(request: Request) {
  if (!await exigirAdmin()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401, headers: SEM_CACHE })
  }

  try {
    const entrada = validarProdutoEventoCompleto(await lerJsonProdutoEvento(request))
    if (entrada.sku === SKU_CANECA_EVENTO_PIRELLI) {
      return NextResponse.json({ error: 'Este SKU é reservado pelo checkout de caneca.' }, { status: 409, headers: SEM_CACHE })
    }
    const evento = await obterEventoPirelli()
    const conflitoSku = await prisma.product.findUnique({
      where: { sku: entrada.sku },
      select: { id: true },
    })
    if (conflitoSku) {
      return NextResponse.json({ error: 'Já existe um produto com este SKU.' }, { status: 409, headers: SEM_CACHE })
    }

    const slug = await slugParaNovoProduto(entrada.nome, entrada.sku)
    const produto = await prisma.product.create({
      data: {
        nome: entrada.nome,
        sku: entrada.sku,
        slug,
        descricao: entrada.descricao,
        categoria: entrada.categoria,
        marca: entrada.marca,
        preco: entrada.preco,
        precoPromocional: entrada.precoPromocional,
        prazoEntregaDias: entrada.prazoEntregaDias,
        peso: entrada.peso,
        altura: entrada.altura,
        largura: entrada.largura,
        comprimento: entrada.comprimento,
        imagens: entrada.imagens,
        temImagem: entrada.imagens.length > 0,
        imagensVerificadas: true,
        ativo: entrada.ativo,
        destaque: entrada.destaque,
        eventoPirelliId: evento.id,
        ordemEvento: entrada.ordemEvento,
        limitePorPedidoEvento: entrada.limitePorPedidoEvento,
        // Regras invariantes desta área: produto sem saldo físico, enviado depois.
        estoque: 0,
        preVenda: true,
        ocultoManual: false,
      },
    })
    return NextResponse.json(serializarProdutoEvento(produto), { status: 201, headers: SEM_CACHE })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'SKU ou endereço do produto já cadastrado.' }, { status: 409, headers: SEM_CACHE })
    }
    if (ehErroValidacaoProdutoEvento(error)) {
      return NextResponse.json({ error: mensagemErroValidacao(error) }, { status: 400, headers: SEM_CACHE })
    }
    console.error('[admin/evento-pirelli/produtos] criação falhou:', error)
    return NextResponse.json({ error: 'Não foi possível cadastrar o produto.' }, { status: 500, headers: SEM_CACHE })
  }
}
