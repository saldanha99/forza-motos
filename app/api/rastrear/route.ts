import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { consumirRateLimitRastreio } from '@/lib/frete/rate-limit-rastreio'
import {
  normalizarVerificacaoRastreio,
  respostaMinimaRastreio,
  verificacaoRastreioConfere,
} from '@/lib/frete/rastreamento-seguro'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SEM_CACHE = { 'Cache-Control': 'no-store, must-revalidate' }

/**
 * POST /api/rastrear
 * Body: { pedido: "FM-2026-0007", verificacao: "email@..." | "CPF" }
 *
 * O número do pedido é sequencial e, portanto, não prova identidade. Uma
 * consulta pública precisa também do e-mail/CPF usado na compra. Dono da conta
 * e administrador já estão autenticados e não precisam repetir esse dado.
 */
export async function POST(req: Request) {
  if (!(await consumirRateLimitRastreio(req))) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' },
      { status: 429, headers: { ...SEM_CACHE, 'Retry-After': '60' } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Dados de consulta inválidos' }, { status: 400, headers: SEM_CACHE })
  }

  const numeroPedido = String(body.pedido ?? '').trim().toUpperCase()
  const verificacao = normalizarVerificacaoRastreio(body.verificacao)

  if (!/^FM-\d{4}-\d{4,}$/.test(numeroPedido)) {
    return NextResponse.json({ error: 'Pedido não encontrado ou dados não conferem' }, { status: 404, headers: SEM_CACHE })
  }

  const pedido = await prisma.order.findUnique({
    where: { orderNumber: numeroPedido },
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      freteServico: true,
      freteTransportadora: true,
      fretePrazo: true,
      trackingCode: true,
      enderecoEntrega: true,
      tracking: {
        orderBy: { createdAt: 'asc' },
        select: { status: true, descricao: true, createdAt: true },
      },
      user: { select: { email: true, cpf: true } },
    },
  })

  if (!pedido) {
    return NextResponse.json({ error: 'Pedido não encontrado ou dados não conferem' }, { status: 404, headers: SEM_CACHE })
  }

  const session = await getServerSession(authOptions).catch(() => null)
  const ehDono = Boolean(pedido.userId && session?.user?.id === pedido.userId)
  const ehAdmin = session?.user?.role === 'ADMIN'

  if (!ehDono && !ehAdmin) {
    const endereco = (pedido.enderecoEntrega ?? {}) as Record<string, unknown>
    const candidatos = [
      pedido.user?.email,
      pedido.user?.cpf,
      endereco.email,
      endereco.cpf,
    ]

    if (!verificacaoRastreioConfere(candidatos, verificacao)) {
      return NextResponse.json({ error: 'Pedido não encontrado ou dados não conferem' }, { status: 404, headers: SEM_CACHE })
    }
  }

  // A página é de acompanhamento: devolve só o necessário para rastrear. CPF,
  // e-mail, endereço, preços e itens nunca atravessam este endpoint.
  return NextResponse.json(respostaMinimaRastreio(pedido), { headers: SEM_CACHE })
}
