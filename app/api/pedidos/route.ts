import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarOrderNumber } from '@/lib/utils'
import { criarPreferencia, montarPayer } from '@/lib/mercadopago'
import { verificarEstoqueTiny } from '@/lib/tiny/verificar-estoque'
import { validarCupom, consumirCupom } from '@/lib/cupom'
// NOTE: a replicação do pedido para o Olist agora acontece APENAS
// dentro do webhook do Mercado Pago, quando o pagamento é aprovado.
// Isso evita que o Olist receba pedidos não pagos e dispare emissão
// precoce de NF.

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()
    const { items, enderecoEntrega, frete, subtotal } = body
    // CPF é obrigatório para o Olist emitir NF. Frete escolhido é replicado ao Olist.
    const { cpf, freteServico, freteTransportadora, fretePrazo, cupomCodigo } = body

    const cpfLimpo = String(cpf ?? enderecoEntrega?.cpf ?? '').replace(/\D/g, '')
    if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
      return NextResponse.json(
        { error: 'CPF inválido. Informe um CPF válido para emissão da nota fiscal.' },
        { status: 400 },
      )
    }
    // Garante que o CPF fica salvo no endereço do pedido (usado na replicação ao Olist)
    const enderecoComCpf = { ...enderecoEntrega, cpf: cpfLimpo }

    // ── Cupom de desconto (validado e calculado no SERVIDOR) ──────────────
    let desconto = 0
    let cupomAplicado: string | undefined
    if (cupomCodigo) {
      const r = await validarCupom(String(cupomCodigo), Number(subtotal))
      if ('erro' in r) {
        return NextResponse.json({ error: r.erro }, { status: 400 })
      }
      desconto = r.desconto
      cupomAplicado = r.codigo
    }
    // Total sempre recalculado no servidor — nunca confia no valor do cliente
    const totalFinal = Math.max(0, Number(subtotal) + Number(frete) - desconto)

    // Descobre quais itens são pré-venda (não consomem estoque nem são checados)
    const infoProdutos = await prisma.product.findMany({
      where: { id: { in: items.map((i: any) => i.productId) } },
      select: { id: true, preVenda: true },
    })
    const ehPreVenda = (id: string) => infoProdutos.find((p) => p.id === id)?.preVenda === true

    // Gera número sequencial do pedido
    const ano = new Date().getFullYear()
    const count = await prisma.order.count({
      where: { createdAt: { gte: new Date(`${ano}-01-01`) } },
    })
    const orderNumber = gerarOrderNumber(count + 1, ano)

    // ── Verificação de estoque em tempo real no Tiny ──────────────────────
    // Bate na API do Tiny antes de criar o pedido para garantir que o
    // estoque não foi vendido no físico desde o último sync periódico.
    // Itens de PRÉ-VENDA são pulados (vendem sem estoque, por definição).
    const verificacao = await verificarEstoqueTiny(
      items
        .filter((i: any) => !ehPreVenda(i.productId))
        .map((i: any) => ({ productId: i.productId, quantidade: i.quantidade }))
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
        desconto,
        cupomCodigo: cupomAplicado,
        total: totalFinal,
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

    // Debita estoque (decrement atômico — dois checkouts simultâneos do último
    // item não podem ler o mesmo saldo) e desativa se zerar
    for (const item of pedido.items) {
      // Pré-venda não tem estoque para debitar (nem deve ser desativado)
      if (item.product.preVenda) continue
      const debitado = await prisma.product.updateMany({
        where: { id: item.productId, estoque: { gte: item.quantidade } },
        data: { estoque: { decrement: item.quantidade } },
      })
      if (debitado.count === 0) {
        // Saldo menor que o pedido (corrida perdida): zera sem ficar negativo
        await prisma.product.update({
          where: { id: item.productId },
          data: { estoque: 0 },
        }).catch(() => {})
      }
      // Desativa quem zerou
      await prisma.product.updateMany({
        where: { id: item.productId, estoque: { lte: 0 } },
        data: { ativo: false },
      })
    }

    // Marca o uso do cupom (só após o pedido existir)
    if (cupomAplicado) await consumirCupom(cupomAplicado)

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
          totalGasto: { increment: totalFinal },
          ultimaCompra: new Date(),
          etapaFunil: 'FECHADO',
        },
        create: {
          userId: session.user.id,
          totalPedidos: 1,
          totalGasto: totalFinal,
          ultimaCompra: new Date(),
          etapaFunil: 'FECHADO',
        },
      })
    }

    // Tenta criar preferência Mercado Pago
    let init_point: string | null = null
    try {
      // Com cupom, o MP recebe um item único com o valor já descontado
      // (o MP não aceita preço negativo, então não dá pra mandar "linha de desconto").
      const mpItems = desconto > 0
        ? [{
            id: pedido.id,
            title: `Pedido ${orderNumber}${cupomAplicado ? ` — cupom ${cupomAplicado}` : ''}`,
            quantity: 1,
            unit_price: Math.max(1, Number((Number(subtotal) - desconto).toFixed(2))),
          }]
        : pedido.items.map((i) => ({
            id: i.productId,
            title: i.product.nome,
            quantity: i.quantidade,
            unit_price: Number(i.precoUnitario),
          }))

      const preferencia = await criarPreferencia({
        items: mpItems,
        // Payer completo (CPF, telefone, endereço): alimenta o antifraude do MP
        // e habilita o Programa de Proteção ao Vendedor contra chargeback
        payer: montarPayer({
          email: session?.user?.email ?? enderecoComCpf?.email ?? null,
          nome: enderecoComCpf?.nome ?? session?.user?.name ?? null,
          telefone: enderecoComCpf?.telefone ?? null,
          cpf: cpfLimpo,
          cep: enderecoComCpf?.cep ?? null,
          rua: enderecoComCpf?.rua ?? null,
          numero: enderecoComCpf?.numero ?? null,
        }),
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
