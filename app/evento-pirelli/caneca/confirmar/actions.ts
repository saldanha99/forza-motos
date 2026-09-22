'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { definirNomeCanecaElegivel } from '@/lib/evento-pirelli'
import { extrairCodigoQrEvento } from '@/lib/eventos/qr-pirelli'

function destino(token: string, parametro: string) {
  return `/evento-pirelli/caneca/confirmar?token=${encodeURIComponent(token)}&${parametro}`
}

export async function confirmarNomeCaneca(formData: FormData) {
  const token = extrairCodigoQrEvento(String(formData.get('token') ?? ''))
  const nomeGravacao = String(formData.get('nomeGravacao') ?? '').trim()
  if (!token) redirect('/evento-pirelli/caneca/confirmar?erro=acesso')

  const visitante = await prisma.eventoPirelliVisitante.findUnique({
    where: { codigoQr: token },
    select: {
      id: true,
      elegibilidadesCaneca: {
        where: { revogadoEm: null },
        select: { id: true },
        take: 1,
      },
      comprasCaneca: {
        where: { pagamentoConfirmadoEm: { not: null }, status: 'PENDENTE' },
        select: { id: true },
        take: 1,
      },
    },
  })
  if (!visitante || (!visitante.elegibilidadesCaneca.length && !visitante.comprasCaneca.length)) {
    redirect(destino(token, 'erro=direito'))
  }

  try {
    await definirNomeCanecaElegivel(visitante.id, nomeGravacao, 'Cliente pelo link seguro')
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : ''
    const erro = mensagem.includes('gravação já começou') ? 'producao' : 'nome'
    redirect(destino(token, `erro=${erro}`))
  }
  redirect(destino(token, 'confirmado=1'))
}
