/**
 * Reconciliação: desativa produtos que sumiram do Tiny
 *
 * Lógica simplificada (sem passar IDs pelo frontend):
 * O Phase 1 sync sempre chama prisma.product.update() para TODOS os produtos
 * do Tiny, atualizando o "updatedAt". Após um sync completo, produtos com
 * updatedAt antigo = não existem mais no Tiny = fantasmas.
 *
 * Parâmetro: { minutosAtras: 90 }
 * → Desativa produtos com tinyId que não foram tocados nos últimos 90 minutos
 * → Use logo após terminar um sync completo (Passo 1)
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  // Janela de tempo: produtos não atualizados nesse período são fantasmas
  // Default 90 min — suficiente para um sync completo terminar
  const minutosAtras: number = body.minutosAtras ?? 90

  try {
    const corteAt = new Date(Date.now() - minutosAtras * 60 * 1000)

    // Conta quantos serão afetados antes de desativar
    const [totalAtivos, fantasmas] = await Promise.all([
      prisma.product.count({ where: { tinyId: { not: null }, ativo: true } }),
      prisma.product.findMany({
        where: {
          tinyId: { not: null },
          ativo: true,
          updatedAt: { lt: corteAt },
        },
        select: { id: true, tinyId: true, nome: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
      }),
    ])

    let desativados = 0
    if (fantasmas.length > 0) {
      const ids = fantasmas.map(p => p.id)
      await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { ativo: false, estoque: 0 },
      })
      desativados = fantasmas.length
    }

    return NextResponse.json({
      totalAtivos,
      desativados,
      corteAt: corteAt.toISOString(),
      minutosAtras,
      exemplos: fantasmas.slice(0, 8).map(p => ({
        nome: p.nome,
        tinyId: p.tinyId,
        ultimaAtualizacao: p.updatedAt,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
