import { prisma } from '@/lib/prisma'
import { obterEventoPirelli } from '@/lib/evento-pirelli'
import { CrmEventoPirelli } from '@/components/evento-pirelli/CrmEventoPirelli'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'CRM — Evento Pirelli' }

export default async function CrmEventoPirelliPage() {
  const evento = await obterEventoPirelli()
  const visitantes = await prisma.eventoPirelliVisitante.findMany({
    where: { eventoId: evento.id },
    orderBy: { createdAt: 'desc' },
    include: {
      tentativaQuiz: true,
      balanceamento: true,
      canecaBrinde: true,
      elegibilidadesCaneca: {
        where: { revogadoEm: null },
        orderBy: { validadoEm: 'desc' },
      },
      comprasCaneca: { orderBy: { registradoEm: 'desc' } },
      lancamentosCaixa: {
        where: { estornadoEm: null },
        orderBy: { confirmadoEm: 'desc' },
      },
      pedidos: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
      },
    },
  })

  return <CrmEventoPirelli
    valorMinimoPneus={Number(evento.valorMinimoPneus)}
    visitantes={visitantes.map((visitante) => ({
      ...visitante,
      createdAt: visitante.createdAt.toISOString(),
      updatedAt: visitante.updatedAt.toISOString(),
      nomeGravacaoConfirmadoEm: visitante.nomeGravacaoConfirmadoEm?.toISOString() ?? null,
      kitParticipacaoEntregueEm: visitante.kitParticipacaoEntregueEm?.toISOString() ?? null,
      tentativaQuiz: visitante.tentativaQuiz ? {
        ...visitante.tentativaQuiz,
        iniciadaEm: visitante.tentativaQuiz.iniciadaEm.toISOString(),
        concluidaEm: visitante.tentativaQuiz.concluidaEm?.toISOString() ?? null,
      } : null,
      canecaBrinde: visitante.canecaBrinde ? {
        ...visitante.canecaBrinde,
        createdAt: visitante.canecaBrinde.createdAt.toISOString(),
        updatedAt: visitante.canecaBrinde.updatedAt.toISOString(),
        gravacaoIniciadaEm: visitante.canecaBrinde.gravacaoIniciadaEm?.toISOString() ?? null,
        prontaEm: visitante.canecaBrinde.prontaEm?.toISOString() ?? null,
        entregueEm: visitante.canecaBrinde.entregueEm?.toISOString() ?? null,
      } : null,
      elegibilidadesCaneca: visitante.elegibilidadesCaneca.map((item) => ({
        ...item,
        valorPneus: item.valorPneus ? Number(item.valorPneus) : null,
        validadoEm: item.validadoEm.toISOString(),
        pagamentoConfirmadoEm: item.pagamentoConfirmadoEm?.toISOString() ?? null,
      })),
      comprasCaneca: visitante.comprasCaneca.map((item) => ({
        ...item,
        valorUnitarioSnapshot: item.valorUnitarioSnapshot ? Number(item.valorUnitarioSnapshot) : null,
        valorPago: item.valorPago ? Number(item.valorPago) : null,
        pagamentoConfirmadoEm: item.pagamentoConfirmadoEm?.toISOString() ?? null,
        registradoEm: item.registradoEm.toISOString(),
        entregueEm: item.entregueEm?.toISOString() ?? null,
      })),
      lancamentosCaixa: visitante.lancamentosCaixa.map((item) => ({
        ...item,
        valorUnitario: item.valorUnitario ? Number(item.valorUnitario) : null,
        valorTotal: Number(item.valorTotal),
        confirmadoEm: item.confirmadoEm.toISOString(),
        createdAt: item.createdAt.toISOString(),
      })),
      pedidos: visitante.pedidos.map((pedido) => ({
        ...pedido,
        total: Number(pedido.total),
        createdAt: pedido.createdAt.toISOString(),
      })),
    }))}
  />
}
