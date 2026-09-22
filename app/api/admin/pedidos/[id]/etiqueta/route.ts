/**
 * POST /api/admin/pedidos/{id}/etiqueta
 *
 * Compra a etiqueta do pedido no Melhor Envio, gera o PDF e captura o rastreio.
 *
 * ⚠️ GASTA SALDO REAL da conta do Melhor Envio. Por isso é um endpoint de admin
 * acionado por clique — o pagamento aprovado só deixa o envio pronto no carrinho.
 *
 * PUT registra/valida a chave da NF-e e prepara o carrinho sem gastar saldo.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  adicionarPedidoAoCarrinho,
  comprarEtiquetaDoPedido,
  gerarEtiquetaDoPedido,
} from '@/lib/frete/envio-me'
import { ehServicoMelhorEnvio } from '@/lib/frete/servico'
import { registrarNfeEPrepararEnvio } from '@/lib/olist/nfe-envio'

export const maxDuration = 60

async function exigirAdmin() {
  const session = await getServerSession(authOptions)
  return session && session.user.role === 'ADMIN'
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      freteServico: true,
      melhorEnvioId: true,
      melhorEnvioStatus: true,
    },
  })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  // Não comprar etiqueta de pedido que não foi pago — dinheiro jogado fora
  if (order.status === 'AGUARDANDO_PAGAMENTO' || order.status === 'CANCELADO') {
    return NextResponse.json(
      { error: `Pedido está ${order.status} — não comprar etiqueta` },
      { status: 400 },
    )
  }
  if (!ehServicoMelhorEnvio(order.freteServico)) {
    return NextResponse.json(
      { error: 'Este pedido usa frete alternativo e deve ser expedido manualmente.' },
      { status: 409 },
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const confirmarNovaTentativa = body?.confirmarNovaTentativa === true
    const podeIniciarEnvio = order.status === 'CONFIRMADO' || order.status === 'SEPARANDO'
    const somenteReconcilia =
      (order.melhorEnvioStatus === 'COMPRA_INCERTA' && !confirmarNovaTentativa) ||
      order.melhorEnvioStatus === 'COMPRADA' ||
      order.melhorEnvioStatus === 'GERADA'
    if (!podeIniciarEnvio && !somenteReconcilia) {
      return NextResponse.json(
        { error: `Pedido está ${order.status} — não iniciar uma nova compra de etiqueta` },
        { status: 409 },
      )
    }

    // Pedido pago antes da integração não tem envio no carrinho ainda
    if (!order.melhorEnvioId) await adicionarPedidoAoCarrinho(order.id)

    const r = await comprarEtiquetaDoPedido(order.id, {
      confirmarNovaTentativa,
    })
    return NextResponse.json(
      { ok: r.confirmado, ...r },
      { status: r.confirmado ? 200 : 202 },
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Falha ao comprar etiqueta no Melhor Envio' },
      { status: 500 },
    )
  }
}

/** Gera/verifica a etiqueta já comprada — nunca debita saldo. */
export async function PATCH(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, freteServico: true },
  })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  if (order.status === 'AGUARDANDO_PAGAMENTO' || order.status === 'CANCELADO') {
    return NextResponse.json({ error: `Pedido está ${order.status} — não gerar etiqueta` }, { status: 409 })
  }
  if (!ehServicoMelhorEnvio(order.freteServico)) {
    return NextResponse.json(
      { error: 'Este pedido usa frete alternativo e deve ser expedido manualmente.' },
      { status: 409 },
    )
  }

  try {
    const r = await gerarEtiquetaDoPedido(order.id)
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Falha ao gerar etiqueta no Melhor Envio' },
      { status: 500 },
    )
  }
}

/** Registra a NF-e e prepara o envio no carrinho — não gasta nada. */
export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const tamanho = Number(req.headers.get('content-length') ?? 0)
    if (Number.isFinite(tamanho) && tamanho > 4 * 1024) {
      return NextResponse.json({ error: 'Dados excedem o limite permitido' }, { status: 413 })
    }
    const body = await req.json().catch(() => ({}))
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        freteServico: true,
        nfeChave: true,
        melhorEnvioId: true,
      },
    })
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    if (order.freteServico === 'retirada') {
      return NextResponse.json({ error: 'Retirada na loja não usa etiqueta de transporte' }, { status: 409 })
    }
    if (!ehServicoMelhorEnvio(order.freteServico)) {
      return NextResponse.json(
        { error: 'Este pedido usa frete alternativo e deve ser expedido manualmente.' },
        { status: 409 },
      )
    }
    if (order.status === 'AGUARDANDO_PAGAMENTO' || order.status === 'CANCELADO') {
      return NextResponse.json(
        { error: `Pedido está ${order.status} — não preparar envio` },
        { status: 409 },
      )
    }
    if (order.status !== 'CONFIRMADO' && order.status !== 'SEPARANDO') {
      return NextResponse.json(
        { error: `Pedido está ${order.status} — não preparar uma nova etiqueta` },
        { status: 409 },
      )
    }

    const r = await registrarNfeEPrepararEnvio(
      params.id,
      body?.nfeChave ?? order.nfeChave,
      'ADMIN_MANUAL',
    )
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Esta chave da NF-e já está vinculada a outro pedido.' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: e?.message || 'Falha ao preparar envio no Melhor Envio' },
      {
        status: /chave NF-e|NF-e modelo|CNPJ emissor|INSCRICAO_ESTADUAL|Inscrição Estadual/i.test(e?.message ?? '')
          ? 422
          : /Pedido está|somente Correios|não pode ser alterada|mudou enquanto/i.test(e?.message ?? '')
            ? 409
            : 500,
      },
    );
  }
}
