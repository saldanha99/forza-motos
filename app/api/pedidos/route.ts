import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarOrderNumber } from '@/lib/utils'
import { criarPreferencia } from '@/lib/mercadopago'
import { replicarPedidoOlist } from '@/lib/olist/sync-orders'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()
    const { items, enderecoEntrega, frete, subtotal, total } = body

    // Gera número sequencial do pedido
    const ano = new Date().getFullYear()
    const count = await prisma.order.count({
      where: { createdAt: { gte: new Date(`${ano}-01-01`) } },
    })
    const orderNumber = gerarOrderNumber(count + 1, ano)

    // Verifica estoque
    for (const item of items) {
      const produto = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!produto || produto.estoque < item.quantidade) {
        return NextResponse.json({ error: `Produto ${produto?.nome ?? item.productId} sem estoque suficiente` }, { status: 400 })
      }
    }

    // Cria pedido
    const pedido = await prisma.order.create({
      data: {
        orderNumber,
        userId: session?.user?.id,
        subtotal,
        frete,
        total,
        enderecoEntrega,
        status: 'AGUARDANDO_PAGAMENTO',
        items: {
          create: items.map((i: any) => ({
            productId: i.productId,
            quantidade: i.quantidade,
            precoUnitario: i.precoUnitario,
          })),
        },
        tracking: {
          create: {
            status: 'AGUARDANDO_PAGAMENTO',
            descricao: 'Pedido criado — aguardando pagamento.',
          },
        },
      },
      include: { items: { include: { product: true } } },
    })

    // Debita estoque e desativa se zerar
    for (const item of pedido.items) {
      const prod = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { estoque: true, temImagem: true }
      })
      if (prod) {
        const novoEstoque = Math.max(0, prod.estoque - item.quantidade)
        const ativo = novoEstoque > 0 && prod.temImagem
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            estoque: novoEstoque,
            ativo,
          },
        })
      }
    }

    // Atualiza CRM
    if (session?.user?.id) {
      await prisma.customerCRM.upsert({
        where: { userId: session.user.id },
        update: {
          totalPedidos: { increment: 1 },
          totalGasto: { increment: total },
          ultimaCompra: new Date(),
          etapaFunil: 'FECHADO',
        },
        create: {
          userId: session.user.id,
          totalPedidos: 1,
          totalGasto: total,
          ultimaCompra: new Date(),
          etapaFunil: 'FECHADO',
        },
      })
    }

    // Tenta criar preferência Mercado Pago
    let init_point: string | null = null
    try {
      const preferencia = await criarPreferencia({
        items: pedido.items.map((i) => ({
          id: i.productId,
          title: i.product.nome,
          quantity: i.quantidade,
          unit_price: Number(i.precoUnitario),
        })),
        payer: session?.user ? { email: session.user.email!, name: session.user.name ?? undefined } : undefined,
        external_reference: pedido.id,
        back_urls: { success: '', failure: '', pending: '' },
      })
      init_point = preferencia.init_point

      await prisma.order.update({
        where: { id: pedido.id },
        data: { pagamentoIdExterno: preferencia.id, pagamentoMetodo: 'mercadopago' },
      })
    } catch (e) {
      console.error('Mercado Pago erro:', e)
    }

    // Replica no OLIST em background (não bloqueia a resposta)
    replicarPedidoOlist(pedido.id).catch(console.error)

    return NextResponse.json({
      id: pedido.id,
      orderNumber: pedido.orderNumber,
      init_point,
    }, { status: 201 })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}
