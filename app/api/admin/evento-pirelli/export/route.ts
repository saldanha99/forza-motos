import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAdmin, linhasCsvCompras, linhasCsvLeads, montarCsv, obterEventoPirelli } from '@/lib/evento-pirelli'

export async function GET(request: Request) {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const tipo = new URL(request.url).searchParams.get('tipo') ?? 'leads'
  const evento = await obterEventoPirelli()
  let conteudo = ''
  if (tipo === 'canecas') {
    const itens = await prisma.eventoPirelliCaneca.findMany({ where: { visitante: { eventoId: evento.id } }, include: { visitante: true, elegibilidades: { where: { revogadoEm: null } } }, orderBy: { createdAt: 'asc' } })
    conteudo = montarCsv([['nome_gravacao', 'nome_completo', 'whatsapp', 'status', 'motivos', 'entregue_em', 'entregue_por'], ...itens.map((item) => [item.nomeGravacaoSnapshot, item.visitante.nomeCompleto, item.visitante.whatsapp, item.status, item.elegibilidades.map((e) => e.origem).join(', '), item.entregueEm?.toISOString(), item.entreguePor])])
  } else if (tipo === 'quiz') {
    const itens = await prisma.eventoPirelliQuizTentativa.findMany({ where: { visitante: { eventoId: evento.id } }, include: { visitante: true }, orderBy: { concluidaEm: 'desc' } })
    conteudo = montarCsv([['nome', 'whatsapp', 'pontuacao', 'pontuacao_maxima', 'acertou_todas', 'concluida_em'], ...itens.map((item) => [item.visitante.nomeCompleto, item.visitante.whatsapp, item.pontuacao, item.pontuacaoMaxima, item.acertouTodas ? 'sim' : 'não', item.concluidaEm.toISOString()])])
  } else if (tipo === 'fotos') {
    const itens = await prisma.eventoPirelliParticipacaoFoto.findMany({ where: { visitante: { eventoId: evento.id } }, include: { visitante: true }, orderBy: { declarouPublicacaoEm: 'desc' } })
    conteudo = montarCsv([['nome', 'instagram', 'status', 'curtidas_apuradas', 'apurado_em'], ...itens.map((item) => [item.visitante.nomeCompleto, item.instagram, item.status, item.curtidasApuradas, item.apuradoEm?.toISOString()])])
  } else if (tipo === 'compras') {
    conteudo = montarCsv(await linhasCsvCompras(evento.id))
  } else {
    conteudo = montarCsv(await linhasCsvLeads(evento.id))
  }
  return new NextResponse('﻿' + conteudo, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="evento-pirelli-${tipo}.csv"` } })
}
