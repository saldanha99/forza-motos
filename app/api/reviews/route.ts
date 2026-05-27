import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/reviews?productId=xxx — lista avaliações aprovadas
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId')
  if (!productId) {
    return NextResponse.json({ error: 'productId obrigatório' }, { status: 400 })
  }

  const reviews = await prisma.review.findMany({
    where: { productId, aprovado: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id:        true,
      nome:      true,
      nota:      true,
      titulo:    true,
      corpo:     true,
      createdAt: true,
    },
  })

  // Calcula média e contagem
  const total = reviews.length
  const media = total > 0
    ? reviews.reduce((acc, r) => acc + r.nota, 0) / total
    : 0

  return NextResponse.json({ reviews, total, media: Number(media.toFixed(1)) })
}

// POST /api/reviews — cria uma nova avaliação
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const body = await req.json()

  const { productId, nome, nota, titulo, corpo } = body

  // Validações
  if (!productId || !nome?.trim() || !nota || !corpo?.trim()) {
    return NextResponse.json({ error: 'Campos obrigatórios: productId, nome, nota, corpo' }, { status: 400 })
  }
  if (nota < 1 || nota > 5) {
    return NextResponse.json({ error: 'Nota deve ser de 1 a 5' }, { status: 400 })
  }
  if (corpo.trim().length < 10) {
    return NextResponse.json({ error: 'Avaliação muito curta (mínimo 10 caracteres)' }, { status: 400 })
  }

  // Verifica se produto existe
  const produto = await prisma.product.findUnique({ where: { id: productId } })
  if (!produto) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const review = await prisma.review.create({
    data: {
      productId,
      userId:  session?.user?.id ?? null,
      nome:    nome.trim(),
      nota:    Number(nota),
      titulo:  titulo?.trim() || null,
      corpo:   corpo.trim(),
      aprovado: true, // auto-aprovado por enquanto
    },
  })

  return NextResponse.json(review, { status: 201 })
}
