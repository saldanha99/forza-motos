import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { baixarEtiquetaPdfME } from '@/lib/frete/melhor-envio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const params = await props.params
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { orderNumber: true, melhorEnvioId: true, melhorEnvioStatus: true },
  })
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  if (!order.melhorEnvioId || order.melhorEnvioStatus !== 'GERADA') {
    return NextResponse.json({ error: 'Etiqueta ainda não está pronta' }, { status: 409 })
  }

  try {
    const pdf = await baixarEtiquetaPdfME(order.melhorEnvioId)
    const nome = `etiqueta-${order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`
    return new Response(pdf.conteudo, {
      headers: {
        'Content-Type': pdf.contentType,
        'Content-Length': String(pdf.conteudo.byteLength),
        'Content-Disposition': `inline; filename="${nome}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Falha ao baixar a etiqueta' },
      { status: 502 },
    )
  }
}
