import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAdmin, obterEventoPirelli } from '@/lib/evento-pirelli'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const evento = await obterEventoPirelli()
  const [visitantes, canecasPendentes, fotosPendentes, quizPerfeitos] = await Promise.all([
    prisma.eventoPirelliVisitante.count({ where: { eventoId: evento.id } }),
    prisma.eventoPirelliCaneca.count({ where: { visitante: { eventoId: evento.id }, status: { in: ['PENDENTE', 'EM_GRAVACAO', 'PRONTA'] } } }),
    prisma.eventoPirelliParticipacaoFoto.count({ where: { visitante: { eventoId: evento.id }, status: 'PENDENTE' } }),
    prisma.eventoPirelliQuizTentativa.count({ where: { visitante: { eventoId: evento.id }, acertouTodas: true } }),
  ])
  return NextResponse.json({ evento, metricas: { visitantes, canecasPendentes, fotosPendentes, quizPerfeitos } })
}

export async function PATCH(request: Request) {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const atual = await obterEventoPirelli()
  const body = await request.json()
  const limite = Number(body.limiteNomeGravacao ?? atual.limiteNomeGravacao)
  const valor = Number(body.valorMinimoPneus ?? atual.valorMinimoPneus)
  if (!Number.isInteger(limite) || limite < 2 || limite > 50 || !Number.isFinite(valor) || valor < 0) return NextResponse.json({ error: 'Configuração inválida.' }, { status: 400 })
  const evento = await prisma.eventoPirelli.update({
    where: { id: atual.id },
    data: {
      titulo: typeof body.titulo === 'string' ? body.titulo.trim() || atual.titulo : undefined,
      descricao: typeof body.descricao === 'string' ? body.descricao.trim() || null : undefined,
      local: typeof body.local === 'string' ? body.local.trim() || null : undefined,
      dataInicio: body.dataInicio ? new Date(body.dataInicio) : body.dataInicio === '' ? null : undefined,
      dataFim: body.dataFim ? new Date(body.dataFim) : body.dataFim === '' ? null : undefined,
      logoForzaUrl: typeof body.logoForzaUrl === 'string' ? body.logoForzaUrl || null : undefined,
      logoPirelliUrl: typeof body.logoPirelliUrl === 'string' ? body.logoPirelliUrl || null : undefined,
      logoCampneusUrl: typeof body.logoCampneusUrl === 'string' ? body.logoCampneusUrl || null : undefined,
      limiteNomeGravacao: limite,
      valorMinimoPneus: valor,
      operadorValorMinimoPneus: body.operadorValorMinimoPneus === 'MAIOR_OU_IGUAL' ? 'MAIOR_OU_IGUAL' : 'MAIOR_QUE',
      ativo: typeof body.ativo === 'boolean' ? body.ativo : undefined,
      publicado: typeof body.publicado === 'boolean' ? body.publicado : undefined,
    },
  })
  return NextResponse.json(evento)
}
