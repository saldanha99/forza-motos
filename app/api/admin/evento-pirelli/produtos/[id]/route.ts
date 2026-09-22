import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirAdmin, obterEventoPirelli } from '@/lib/evento-pirelli'
import { SKU_CANECA_EVENTO_PIRELLI } from '@/lib/checkout/caneca-evento-pirelli'
import {
  ehErroValidacaoProdutoEvento,
  ErroValidacaoProdutoEvento,
  lerJsonProdutoEvento,
  mensagemErroValidacao,
  patchProdutoEventoSchema,
  serializarProdutoEvento,
  validarProdutoEventoCompleto,
} from '../validacao'

export const dynamic = 'force-dynamic'

const SEM_CACHE = { 'Cache-Control': 'no-store, must-revalidate' }

type ContextoRota = { params: Promise<{ id: string }> }

function imagensDoProduto(valor: Prisma.JsonValue): string[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is string => typeof item === 'string')
}

export async function PATCH(request: Request, contexto: ContextoRota) {
  if (!await exigirAdmin()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401, headers: SEM_CACHE })
  }

  try {
    const { id } = await contexto.params
    const evento = await obterEventoPirelli()
    const existente = await prisma.product.findFirst({
      where: {
        id,
        eventoPirelliId: evento.id,
        sku: { not: SKU_CANECA_EVENTO_PIRELLI },
      },
    })
    if (!existente) {
      return NextResponse.json({ error: 'Produto do evento não encontrado.' }, { status: 404, headers: SEM_CACHE })
    }

    const alteracoes = patchProdutoEventoSchema.parse(await lerJsonProdutoEvento(request))
    const entrada = validarProdutoEventoCompleto({
      nome: existente.nome,
      sku: existente.sku,
      descricao: existente.descricao,
      categoria: existente.categoria,
      marca: existente.marca,
      preco: Number(existente.preco),
      precoPromocional: existente.precoPromocional == null ? 0 : Number(existente.precoPromocional),
      prazoEntregaDias: existente.prazoEntregaDias ?? 0,
      peso: existente.peso == null ? 0 : Number(existente.peso),
      altura: existente.altura == null ? 0 : Number(existente.altura),
      largura: existente.largura == null ? 0 : Number(existente.largura),
      comprimento: existente.comprimento == null ? 0 : Number(existente.comprimento),
      imagens: imagensDoProduto(existente.imagens),
      ativo: existente.ativo,
      destaque: existente.destaque,
      ordemEvento: existente.ordemEvento,
      limitePorPedidoEvento: existente.limitePorPedidoEvento ?? 1,
      ...alteracoes,
    })

    if (entrada.sku !== existente.sku) {
      const conflitoSku = await prisma.product.findFirst({
        where: { sku: entrada.sku, id: { not: existente.id } },
        select: { id: true },
      })
      if (conflitoSku) {
        return NextResponse.json({ error: 'Já existe um produto com este SKU.' }, { status: 409, headers: SEM_CACHE })
      }
    }

    const produto = await prisma.product.update({
      where: { id: existente.id },
      data: {
        nome: entrada.nome,
        sku: entrada.sku,
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
        ordemEvento: entrada.ordemEvento,
        limitePorPedidoEvento: entrada.limitePorPedidoEvento,
        // Estas regras não podem ser removidas por payload do navegador.
        eventoPirelliId: evento.id,
        estoque: 0,
        preVenda: true,
        ocultoManual: false,
      },
    })

    return NextResponse.json(serializarProdutoEvento(produto), { headers: SEM_CACHE })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'SKU já cadastrado em outro produto.' }, { status: 409, headers: SEM_CACHE })
    }
    if (ehErroValidacaoProdutoEvento(error)) {
      return NextResponse.json({ error: mensagemErroValidacao(error) }, { status: 400, headers: SEM_CACHE })
    }
    console.error('[admin/evento-pirelli/produtos] atualização falhou:', error)
    return NextResponse.json({ error: 'Não foi possível atualizar o produto.' }, { status: 500, headers: SEM_CACHE })
  }
}

/**
 * Arquivamento lógico: nunca remove a linha, os itens vendidos nem os snapshots
 * da promessa de entrega já assumida com o cliente.
 */
export async function DELETE(_request: Request, contexto: ContextoRota) {
  if (!await exigirAdmin()) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401, headers: SEM_CACHE })
  }

  try {
    const { id } = await contexto.params
    const evento = await obterEventoPirelli()
    const existente = await prisma.product.findFirst({
      where: {
        id,
        eventoPirelliId: evento.id,
        sku: { not: SKU_CANECA_EVENTO_PIRELLI },
      },
      select: { id: true },
    })
    if (!existente) {
      return NextResponse.json({ error: 'Produto do evento não encontrado.' }, { status: 404, headers: SEM_CACHE })
    }

    const [produto, itensVendidos] = await prisma.$transaction([
      prisma.product.update({ where: { id }, data: { ativo: false } }),
      prisma.orderItem.count({ where: { productId: id } }),
    ])

    return NextResponse.json({
      produto: serializarProdutoEvento(produto),
      arquivado: true,
      historicoPreservado: itensVendidos > 0,
    }, { headers: SEM_CACHE })
  } catch (error) {
    if (error instanceof ErroValidacaoProdutoEvento) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: SEM_CACHE })
    }
    console.error('[admin/evento-pirelli/produtos] arquivamento falhou:', error)
    return NextResponse.json({ error: 'Não foi possível desativar o produto.' }, { status: 500, headers: SEM_CACHE })
  }
}
