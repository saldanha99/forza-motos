import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DESCRICOES: Record<string, string> = {
  CONFIRMADO: 'Pagamento confirmado — pedido em processamento.',
  SEPARANDO: 'Pedido sendo separado no estoque.',
  ENVIADO: 'Pedido enviado para os Correios.',
  ENTREGUE: 'Pedido entregue ao destinatário.',
  CANCELADO: 'Pedido cancelado.',
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { status } = await req.json()

  const pedido = await prisma.order.update({
    where: { id: params.id },
    data: {
      status,
      tracking: {
        create: {
          status,
          descricao: DESCRICOES[status] ?? `Status atualizado para ${status}`,
        },
      },
    },
  })

  return NextResponse.json(pedido)
}
