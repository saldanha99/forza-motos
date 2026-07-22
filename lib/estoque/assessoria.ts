/**
 * Consultas de assessoria (somente leitura) — usadas tanto pelo resumo diário
 * (Fase 2) quanto pelas ferramentas da IA conversacional (Fase 3).
 */
import { prisma } from '@/lib/prisma'

function inicioDoDia(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function fimDoDia(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

const fmtData = (d: Date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d)

/** Agendamentos de uma data (default hoje), ordenados por horário. */
export async function consultarAgenda(data?: Date) {
  const dia = data ?? new Date()
  const ags = await prisma.appointment.findMany({
    where: { dataPreferida: { gte: inicioDoDia(dia), lte: fimDoDia(dia) } },
    orderBy: { horarioPreferido: 'asc' },
    select: { nome: true, telefone: true, servico: true, motoModelo: true, horarioPreferido: true, status: true },
  })
  return { data: fmtData(dia), total: ags.length, agendamentos: ags }
}

/** Agendamentos pendentes de confirmação (status pendente), do dia em diante. */
export async function agendamentosPendentes() {
  const ags = await prisma.appointment.findMany({
    where: { status: 'pendente', dataPreferida: { gte: inicioDoDia(new Date()) } },
    orderBy: { dataPreferida: 'asc' },
    select: { nome: true, telefone: true, servico: true, dataPreferida: true, horarioPreferido: true },
    take: 30,
  })
  return ags.map((a) => ({ ...a, data: fmtData(a.dataPreferida) }))
}

/**
 * Produtos onde as reservas ativas alcançam/ultrapassam o estoque
 * (risco de dois clientes disputando o mesmo item).
 */
export async function conflitosReserva() {
  const grupos = await prisma.reservaEstoque.groupBy({
    by: ['productId'],
    where: { status: 'ATIVA' },
    _sum: { quantidade: true },
  })
  if (grupos.length === 0) return []

  const produtos = await prisma.product.findMany({
    where: { id: { in: grupos.map((g) => g.productId) } },
    select: { id: true, nome: true, estoque: true },
  })
  const nomeDe = new Map(produtos.map((p) => [p.id, p]))

  const conflitos = grupos
    .map((g) => {
      const p = nomeDe.get(g.productId)
      const reservado = g._sum.quantidade ?? 0
      return p ? { nome: p.nome, estoque: p.estoque, reservado } : null
    })
    .filter((x): x is { nome: string; estoque: number; reservado: number } => x !== null && x.reservado >= x.estoque)

  return conflitos
}

/** Busca estoque disponível de produtos por termo (nome/SKU). */
export async function consultarEstoque(termo: string) {
  const q = termo.trim()
  if (q.length < 2) return []
  const produtos = await prisma.product.findMany({
    where: {
      ativo: true,
      OR: [
        { nome: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, nome: true, sku: true, estoque: true },
    take: 10,
    orderBy: { estoque: 'desc' },
  })

  return Promise.all(
    produtos.map(async (p) => {
      const r = await prisma.reservaEstoque.aggregate({
        where: { productId: p.id, status: 'ATIVA' },
        _sum: { quantidade: true },
      })
      const reservado = r._sum.quantidade ?? 0
      return { nome: p.nome, sku: p.sku, estoque: p.estoque, reservado, disponivel: Math.max(0, p.estoque - reservado) }
    })
  )
}
