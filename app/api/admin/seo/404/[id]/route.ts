import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Alterna o campo `resolvido` de um registro de 404 — usado depois de criar o redirect correspondente. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { resolvido } = body as { resolvido?: unknown }

  if (typeof resolvido !== 'boolean') {
    return NextResponse.json({ error: 'Campo "resolvido" precisa ser booleano' }, { status: 400 })
  }

  // Sem findUnique antes: o próprio update devolve P2025 se o registro sumiu,
  // o que evita uma consulta extra e a janela de corrida entre as duas.
  try {
    const registro = await prisma.seoNotFoundLog.update({
      where: { id: params.id },
      data: { resolvido },
    })
    return NextResponse.json(registro)
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }
    throw e
  }
}
