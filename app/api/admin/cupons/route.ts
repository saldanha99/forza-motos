/**
 * GET  /api/admin/cupons — lista todos os cupons
 * POST /api/admin/cupons — cria um cupom
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizarCodigoCupom } from '@/lib/cupom'

export const dynamic = 'force-dynamic'

async function exigirAdmin() {
  const session = await getServerSession(authOptions)
  return session && session.user.role === 'ADMIN'
}

export async function GET() {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const cupons = await prisma.cupom.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(cupons)
}

export async function POST(req: Request) {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const codigo = normalizarCodigoCupom(body.codigo)
  const tipo = body.tipo === 'VALOR' ? 'VALOR' : 'PERCENTUAL'
  const valor = Number(body.valor)

  if (!codigo) return NextResponse.json({ error: 'Informe o código do cupom.' }, { status: 400 })
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: 'Valor do desconto inválido.' }, { status: 400 })
  }
  if (tipo === 'PERCENTUAL' && valor > 100) {
    return NextResponse.json({ error: 'Percentual não pode passar de 100%.' }, { status: 400 })
  }

  const existente = await prisma.cupom.findUnique({ where: { codigo } })
  if (existente) return NextResponse.json({ error: 'Já existe um cupom com esse código.' }, { status: 409 })

  const cupom = await prisma.cupom.create({
    data: {
      codigo,
      tipo,
      valor,
      minSubtotal: body.minSubtotal ? Number(body.minSubtotal) : null,
      validadeAte: body.validadeAte ? new Date(body.validadeAte) : null,
      usoMaximo: body.usoMaximo ? Number(body.usoMaximo) : null,
      descricao: body.descricao?.trim() || null,
      ativo: true,
    },
  })
  return NextResponse.json(cupom, { status: 201 })
}
