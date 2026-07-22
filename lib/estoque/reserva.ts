/**
 * Assessoria de estoque — Fase 1 (determinística, sem IA).
 *
 * Quando um agendamento reserva um produto (ex.: um pneu específico), criamos
 * uma ReservaEstoque. O estoque disponível de verdade passa a ser
 *   estoqueDisponivel = estoque - soma das reservas ATIVAS.
 *
 * Se as reservas passarem do estoque (dois clientes querendo o último pneu),
 * disparamos um alerta no grupo de WhatsApp da assessoria com os agendamentos
 * envolvidos — que foi exatamente a dor que o Caio levantou na reunião.
 */
import { prisma } from '@/lib/prisma'
import { enviarParaGrupo } from '@/lib/evolution/grupo'

/** Soma das reservas ATIVAS de um produto */
export async function reservasAtivas(productId: string): Promise<number> {
  const r = await prisma.reservaEstoque.aggregate({
    where: { productId, status: 'ATIVA' },
    _sum: { quantidade: true },
  })
  return r._sum.quantidade ?? 0
}

/** estoque - reservas ativas (nunca negativo para exibição) */
export async function estoqueDisponivel(productId: string): Promise<number> {
  const [produto, reservado] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { estoque: true } }),
    reservasAtivas(productId),
  ])
  return Math.max(0, (produto?.estoque ?? 0) - reservado)
}

/**
 * Cria a reserva de um produto para um agendamento e, se houver conflito
 * (reservas ativas passam do estoque), alerta o grupo da assessoria.
 * Retorna a reserva criada e se gerou conflito.
 */
export async function criarReserva(
  appointmentId: string,
  productId: string,
  quantidade = 1,
): Promise<{ id: string; conflito: boolean }> {
  const reserva = await prisma.reservaEstoque.create({
    data: { appointmentId, productId, quantidade, status: 'ATIVA' },
  })

  const [produto, reservado] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { nome: true, estoque: true } }),
    reservasAtivas(productId),
  ])

  const conflito = Boolean(produto) && reservado > (produto!.estoque ?? 0)
  if (conflito) {
    await alertarConflito(productId, produto!.nome, produto!.estoque, reservado).catch((e) =>
      console.error('[reserva] falha ao alertar grupo:', e),
    )
  }
  return { id: reserva.id, conflito }
}

/** Cancela uma reserva (ex.: agendamento cancelado ou produto trocado) */
export async function cancelarReserva(reservaId: string): Promise<void> {
  await prisma.reservaEstoque
    .update({ where: { id: reservaId }, data: { status: 'CANCELADA' } })
    .catch(() => {})
}

/** Marca as reservas de um agendamento como consumidas (serviço concluído) */
export async function consumirReservasDoAgendamento(appointmentId: string): Promise<void> {
  await prisma.reservaEstoque
    .updateMany({ where: { appointmentId, status: 'ATIVA' }, data: { status: 'CONSUMIDA' } })
    .catch(() => {})
}

/** Libera as reservas de um agendamento (cancelado) — o estoque volta a ficar disponível */
export async function cancelarReservasDoAgendamento(appointmentId: string): Promise<void> {
  await prisma.reservaEstoque
    .updateMany({ where: { appointmentId, status: 'ATIVA' }, data: { status: 'CANCELADA' } })
    .catch(() => {})
}

/** Monta e envia o alerta de conflito de estoque no grupo da assessoria */
async function alertarConflito(
  productId: string,
  nomeProduto: string,
  estoque: number,
  reservado: number,
): Promise<void> {
  // Agendamentos que estão segurando esse produto
  const reservas = await prisma.reservaEstoque.findMany({
    where: { productId, status: 'ATIVA' },
    include: { appointment: { select: { nome: true, dataPreferida: true, horarioPreferido: true, telefone: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const linhasClientes = reservas
    .map((r) => {
      const a = r.appointment
      const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(a.dataPreferida)
      return `• ${a.nome} — ${data} ${a.horarioPreferido} (${a.telefone})`
    })
    .join('\n')

  const msg =
    `⚠️ *Conflito de estoque*\n\n` +
    `Produto: *${nomeProduto}*\n` +
    `Em estoque: *${estoque}* · Reservado por agendamento: *${reservado}*\n\n` +
    `Agendamentos que querem esse item:\n${linhasClientes}\n\n` +
    `Confirme o reabastecimento ou combine com os clientes.`

  await enviarParaGrupo(msg)
}
