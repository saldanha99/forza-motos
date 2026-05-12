/**
 * Sincroniza status de pedidos entre o Tiny ERP e o banco local
 * Busca pedidos do Tiny e atualiza status + rastreio na nossa plataforma
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tinyFetch } from '@/lib/olist/client'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

// Mapeamento de situação do Tiny → status interno
const STATUS_MAP: Record<string, string> = {
  'Em aberto':         'AGUARDANDO_PAGAMENTO',
  'Aprovado':          'CONFIRMADO',
  'Preparando envio':  'SEPARANDO',
  'Faturado':          'SEPARANDO',
  'Em separação':      'SEPARANDO',
  'Pronto para envio': 'SEPARANDO',
  'Enviado':           'ENVIADO',
  'Entregue':          'ENTREGUE',
  'Cancelado':         'CANCELADO',
  'Devolvido':         'CANCELADO',
  // Versão em inglês (fallback)
  'approved':          'CONFIRMADO',
  'shipped':           'ENVIADO',
  'delivered':         'ENTREGUE',
  'canceled':          'CANCELADO',
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    // Busca pedidos recentes do Tiny (últimos 30 dias por padrão)
    const data = await tinyFetch('pedidos.pesquisa.php', {
      numero: '', // busca todos
      situacao: '', // todas as situações
    })

    const pedidosTiny = (data.retorno?.pedidos ?? []).map((p: any) => p.pedido ?? p)
    let atualizados = 0
    let erros = 0

    for (const pt of pedidosTiny) {
      try {
        const tinyOrderId = String(pt.id || pt.numero_ecommerce || '')
        const novasSituacao = pt.situacao || ''
        const novoStatus = STATUS_MAP[novasSituacao]

        if (!tinyOrderId || !novoStatus) continue

        // Tenta achar pelo olistOrderId ou pelo orderNumber (número do ecommerce no Tiny)
        const pedido = await prisma.order.findFirst({
          where: {
            OR: [
              { olistOrderId: tinyOrderId },
              { orderNumber: pt.numero_ecommerce ?? '' },
            ],
          },
        })

        if (!pedido) continue
        if (pedido.status === novoStatus) continue // sem mudança

        await prisma.order.update({
          where: { id: pedido.id },
          data: {
            status: novoStatus as any,
            tracking: {
              create: {
                status: novoStatus,
                descricao: `Status atualizado via Tiny ERP: "${novasSituacao}"`,
              },
            },
          },
        })
        atualizados++
      } catch {
        erros++
      }
    }

    return NextResponse.json({
      ok: true,
      totalTiny: pedidosTiny.length,
      atualizados,
      erros,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
