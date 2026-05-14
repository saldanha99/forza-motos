/**
 * Reseta imagensVerificadas=false para todos os produtos sem foto
 * Permite que o "Buscar imagens" re-consulte o Tiny para tentar puxar novas fotos
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // Reseta TODOS os produtos com tinyId que não têm imagem
  const result = await prisma.product.updateMany({
    where: {
      tinyId: { not: null },
      temImagem: false,
    },
    data: {
      imagensVerificadas: false,
      imagens: [],
    },
  })

  return NextResponse.json({
    ok: true,
    resetados: result.count,
    info: `${result.count} produtos resetados — execute "Buscar imagens" para re-sincronizar`,
  })
}
