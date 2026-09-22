import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reconciliarPagamentosEventos } from '@/lib/eventos/reconciliacao'

export const dynamic = 'force-dynamic'

const TOKEN_CONSULTA = /^[A-Za-z0-9_-]{40,60}$/

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token || !TOKEN_CONSULTA.test(token)) {
    return NextResponse.json({ error: 'Inscrição não localizada.' }, { status: 404 })
  }

  let inscricao = await prisma.eventoInscricao.findUnique({
    where: { consultaToken: token },
    select: { id: true, status: true, mpStatus: true, mpPreferenciaId: true, updatedAt: true },
  })
  if (!inscricao) {
    return NextResponse.json({ error: 'Inscrição não localizada.' }, { status: 404 })
  }

  if (inscricao.status === 'PENDENTE' && inscricao.mpPreferenciaId) {
    await reconciliarPagamentosEventos({
      inscricaoIds: [inscricao.id],
      limite: 1,
      forcarConsulta: true,
    }).catch((error) => {
      console.warn(`[eventos/status] Reconciliação transitória falhou para ${inscricao!.id}`, error)
    })
    inscricao = await prisma.eventoInscricao.findUniqueOrThrow({
      where: { id: inscricao.id },
      select: { id: true, status: true, mpStatus: true, mpPreferenciaId: true, updatedAt: true },
    })
  }

  return NextResponse.json(
    {
      status: inscricao.status,
      pagamento: inscricao.mpStatus,
      atualizadoEm: inscricao.updatedAt.toISOString(),
    },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  )
}
