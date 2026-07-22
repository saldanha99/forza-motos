/**
 * GET/POST /api/assessoria/resumo-diario — envia o resumo do dia ao grupo de
 * assessoria (Fase 2). Protegido por CRON_SECRET.
 *
 * Cron na VPS (8h todo dia):
 *   0 8 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://www.forzamotos.com.br/api/assessoria/resumo-diario
 */
import { NextResponse } from 'next/server'
import { consultarAgenda, agendamentosPendentes, conflitosReserva } from '@/lib/estoque/assessoria'
import { enviarParaGrupo } from '@/lib/evolution/grupo'

export const dynamic = 'force-dynamic'

async function handler(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const [agenda, pendentes, conflitos] = await Promise.all([
    consultarAgenda(),
    agendamentosPendentes(),
    conflitosReserva(),
  ])

  // Monta a mensagem
  const linhas: string[] = [`☀️ *Bom dia! Resumo Forza — ${agenda.data}*`, '']

  linhas.push(`📅 *Agenda de hoje* (${agenda.total})`)
  if (agenda.total === 0) {
    linhas.push('• Sem agendamentos para hoje.')
  } else {
    for (const a of agenda.agendamentos) {
      linhas.push(`• ${a.horarioPreferido} — ${a.nome} · ${a.servico} (${a.motoModelo})`)
    }
  }
  linhas.push('')

  if (pendentes.length > 0) {
    linhas.push(`⏳ *Pendentes de confirmação* (${pendentes.length})`)
    for (const p of pendentes.slice(0, 10)) {
      linhas.push(`• ${p.data} ${p.horarioPreferido} — ${p.nome} · ${p.servico}`)
    }
    linhas.push('')
  }

  if (conflitos.length > 0) {
    linhas.push('⚠️ *Estoque em risco* (reservas ≥ estoque)')
    for (const c of conflitos) {
      linhas.push(`• ${c.nome} — estoque ${c.estoque}, reservado ${c.reservado}`)
    }
    linhas.push('')
  }

  linhas.push('Bom trabalho! 🏍️')

  const r = await enviarParaGrupo(linhas.join('\n'))
  return NextResponse.json({ ok: r.ok, erro: r.erro, enviado: r.ok })
}

export const GET = handler
export const POST = handler
