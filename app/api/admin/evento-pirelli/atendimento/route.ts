import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bloquearVisitanteEvento, buscarAtendimento, buscarVisitanteAtendimentoPorId, criarElegibilidadeDeCaneca, exigirAdmin, obterEventoPirelli, registrarCompraCaneca } from '@/lib/evento-pirelli'

export async function GET(request: Request) {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const url = new URL(request.url)
  const id = url.searchParams.get('id')?.trim()
  const evento = await obterEventoPirelli()

  if (id) {
    const visitante = await buscarVisitanteAtendimentoPorId(id, evento.id)
    if (!visitante) return NextResponse.json({ error: 'Visitante não encontrado.' }, { status: 404 })
    return NextResponse.json(visitante)
  }

  const busca = url.searchParams.get('codigo')?.trim()
  if (!busca) return NextResponse.json({ error: 'Informe o QR, nome ou telefone.' }, { status: 400 })
  const resultado = await buscarAtendimento(evento.id, busca)
  if (!resultado) return NextResponse.json({ error: 'Visitante não encontrado.' }, { status: 404 })
  if (resultado.tipo === 'multiplos') return NextResponse.json({ multiplos: resultado.candidatos })
  return NextResponse.json(resultado.visitante)
}

export async function POST(request: Request) {
  const session = await exigirAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    const visitanteId = String(body.visitanteId ?? '')
    const operador = session.user.email ?? 'Equipe'
    if (body.acao === 'status-caneca') {
      const status = body.status
      if (!['PENDENTE', 'EM_GRAVACAO', 'PRONTA', 'ENTREGUE', 'CANCELADA'].includes(status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
      const agora = new Date()
      // Mesmo lock das decisões de elegibilidade: sem ele, marcar ENTREGUE podia
      // cruzar com uma despromoção de foto e um dos dois escrevia por cima do outro.
      const caneca = await prisma.$transaction(async (tx) => {
        await bloquearVisitanteEvento(tx, visitanteId)
        return tx.eventoPirelliCaneca.update({ where: { visitanteId }, data: { status, gravacaoIniciadaEm: status === 'EM_GRAVACAO' ? agora : undefined, gravadoPor: status === 'EM_GRAVACAO' ? operador : undefined, prontaEm: status === 'PRONTA' ? agora : undefined, entregueEm: status === 'ENTREGUE' ? agora : undefined, entreguePor: status === 'ENTREGUE' ? operador : undefined } })
      })
      return NextResponse.json(caneca)
    }
    if (body.acao === 'validar-compra-pneus') {
      const evento = await obterEventoPirelli()
      const valorPneus = Number(body.valorPneus)
      const elegivel = evento.operadorValorMinimoPneus === 'MAIOR_QUE' ? valorPneus > Number(evento.valorMinimoPneus) : valorPneus >= Number(evento.valorMinimoPneus)
      if (!Number.isFinite(valorPneus) || !elegivel) return NextResponse.json({ error: `Subtotal de pneus não atende à promoção (regra atual: ${evento.operadorValorMinimoPneus === 'MAIOR_QUE' ? 'maior que' : 'maior ou igual a'} R$ ${Number(evento.valorMinimoPneus).toFixed(2)}).` }, { status: 400 })
      const elegibilidade = await criarElegibilidadeDeCaneca({ visitanteId, origem: 'COMPRA_PNEUS', valorPneus, referenciaVenda: String(body.referenciaVenda ?? '').trim() || null, validadoPor: operador })
      return NextResponse.json(elegibilidade)
    }
    if (body.acao === 'registrar-compra-caneca') {
      const chaveIdempotencia = String(body.chaveIdempotencia ?? '').trim()
      if (!chaveIdempotencia) return NextResponse.json({ error: 'Requisição sem chave de idempotência.' }, { status: 400 })
      const visitante = await prisma.eventoPirelliVisitante.findUniqueOrThrow({ where: { id: visitanteId } })
      const quantidade = Math.max(1, Math.floor(Number(body.quantidade ?? 1)))
      // Idempotente pela chave gerada no cliente: duplo clique/retry no mesmo pedido não cria uma segunda venda.
      const compra = await registrarCompraCaneca({
        eventoId: visitante.eventoId,
        visitanteId,
        quantidade,
        nomeGravacaoSnapshot: visitante.nomeGravacao,
        referenciaVenda: String(body.referenciaVenda ?? '').trim() || null,
        chaveIdempotencia,
      })
      return NextResponse.json(compra)
    }
    if (body.acao === 'status-compra-caneca') {
      const status = body.status
      if (!['PENDENTE', 'EM_GRAVACAO', 'PRONTA', 'ENTREGUE', 'CANCELADA'].includes(status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
      const compraId = String(body.compraId ?? '')
      const agora = new Date()
      const existente = await prisma.eventoPirelliCompraCaneca.findFirst({ where: { id: compraId, visitanteId } })
      if (!existente) return NextResponse.json({ error: 'Venda de caneca não encontrada para este visitante.' }, { status: 404 })
      const compra = await prisma.eventoPirelliCompraCaneca.update({
        where: { id: compraId },
        data: { status, entregueEm: status === 'ENTREGUE' ? agora : undefined, entreguePor: status === 'ENTREGUE' ? operador : undefined },
      })
      return NextResponse.json(compra)
    }
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (error: any) { return NextResponse.json({ error: error?.message ?? 'Não foi possível concluir a operação.' }, { status: 400 }) }
}
