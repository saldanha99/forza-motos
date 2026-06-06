import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarOrderNumber } from '@/lib/utils'
import { criarPreferencia } from '@/lib/mercadopago'
import { verificarEstoqueTiny } from '@/lib/tiny/verificar-estoque'
// NOTE: a replicação do pedido para o Olist agora acontece APENAS
// dentro do webhook do Mercado Pago, quando o pagamento é aprovado.
// Isso evita que o Olist receba pedidos não pagos e dispare emissão
// precoce de NF.

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()
    const { items, enderecoEntrega, frete, subtotal, total } = body
    // CPF é obrigatório para o Olist emitir NF. Frete escolhido é replicado ao Olist.
    const { cpf, freteServico, freteTransportadora, fretePrazo } = body

    const cpfLimpo = String(cpf ?? enderecoEntrega?.cpf ?? '').replace(/\D/g, '')
    if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
      return NextResponse.json(
        { error: 'CPF inválido. Informe um CPF válido para emissão da nota fiscal.' },
        { status: 400 },
      )
    }
    // Garante que o CPF fica salvo no endereço do pedido (usado na replicação ao Olist)
    const enderecoComCpf = { ...enderecoEntrega, cpf: cpfLimpo }

    // Gera número sequencial do pedido
    const ano = new Date().getFullYear()
    const count = await prisma.order.count({
      where: { createdAt: { gte: new Date(`${ano}-01-01`) } },
    })
    const orderNumber = gerarOrderNumber(count + 1, ano)

    // ── Verificação de estoque em tempo real no Tiny ──────────────────────
    // Bate na API do Tiny antes de criar o pedido para garantir que o
    // estoque não foi vendido no físico desde o último sync periódico.
    const verificacao = await verificarEstoqueTiny(
      items.map((i: any) => ({ productId: i.productId, quantidade: i.quantidade }))
    )
    if (!verificacao.ok) {
      const nomes = verificacao.esgotados.map((e) =>
        `${e.nome} (disponível: ${e.estoqueReal === 0 ? 'esgotado' : e.estoqueReal})`
      ).join(', ')
      return NextResponse.json(
        { error: `Produto(s) sem estoque suficiente: ${nomes}` },
        { status: 400 }
      )
    }

    // Cria pedido
    const pedido = await prisma.order.create({
      data: {
        orderNumber,
        userId: session?.user?.id,
        subtotal,
        frete,
        total,
        enderecoEntrega: enderecoComCpf,
        // Frete escolhido pelo cliente — replicado ao Olist na confirmação
        freteServico:        freteServico ?? undefined,
        freteTransportadora: freteTransportadora ?? undefined,
        fretePrazo:          fretePrazo != null ? Number(fretePrazo) : undefined,
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

    // Persiste o CPF no cadastro do cliente logado (para próximas compras / NF)
    if (session?.user?.id) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { cpf: cpfLimpo },
      }).catch(() => {})
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

    // Replicação no Olist movida para o webhook do Mercado Pago — só
    // replica quando pagamento for aprovado (ver app/api/mercadopago/webhook).

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
