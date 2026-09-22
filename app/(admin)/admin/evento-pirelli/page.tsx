import QRCode from 'qrcode'
import { obterEventoPirelli } from '@/lib/evento-pirelli'
import { AdminEventoPirelli } from '@/components/evento-pirelli/AdminEventoPirelli'
import { SITE_URL } from '@/lib/schema'
import { prisma } from '@/lib/prisma'
import { DESAFIO_FOTO_ATIVO } from '@/lib/evento-pirelli/config'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Evento Pirelli — Forza Admin' }

export default async function EventoPirelliAdminPage() {
  const evento = await obterEventoPirelli()
  const [totaisCaixa, porForma] = await Promise.all([
    prisma.eventoPirelliLancamentoCaixa.aggregate({
      where: { eventoId: evento.id, estornadoEm: null },
      _sum: { valorTotal: true },
      _count: { id: true },
    }),
    prisma.eventoPirelliLancamentoCaixa.groupBy({
      by: ['formaPagamento'],
      where: { eventoId: evento.id, estornadoEm: null },
      _sum: { valorTotal: true },
      _count: { id: true },
      orderBy: { formaPagamento: 'asc' },
    }),
  ])
  const destinos = [
    { titulo: 'Caneca personalizada', descricao: 'Cadastro e compra somente da caneca', url: `${SITE_URL}/evento-pirelli/cadastro?acao=caneca` },
    { titulo: 'Ganhe nas compras', descricao: 'Vitrine sem cadastro; dados somente no checkout', url: `${SITE_URL}/evento-pirelli/ofertas` },
    { titulo: 'Quiz cronometrado', descricao: 'Cadastro, preparação e tentativa iniciada somente por clique', url: `${SITE_URL}/evento-pirelli/cadastro?acao=quiz` },
    ...(DESAFIO_FOTO_ATIVO ? [{ titulo: 'Desafio da foto', descricao: 'Cadastro e envio da participação no Instagram', url: `${SITE_URL}/evento-pirelli/cadastro?acao=foto` }] : []),
    { titulo: 'Balanceamento', descricao: 'Cadastro para entender e participar da demonstração', url: `${SITE_URL}/evento-pirelli/cadastro?acao=balanceamento` },
  ]
  const qrs = await Promise.all(destinos.map(async (item) => ({ ...item, svg: await QRCode.toString(item.url, { type: 'svg', width: 220, margin: 1 }) })))
  return <AdminEventoPirelli
    evento={{ ...evento, dataInicio: evento.dataInicio?.toISOString() ?? null, dataFim: evento.dataFim?.toISOString() ?? null, valorMinimoPneus: Number(evento.valorMinimoPneus), valorCanecaAvulsa: Number(evento.valorCanecaAvulsa) }}
    qrs={qrs}
    resumoCaixa={{
      total: Number(totaisCaixa._sum.valorTotal ?? 0),
      lancamentos: totaisCaixa._count.id,
      porForma: porForma.map((item) => ({ forma: item.formaPagamento, total: Number(item._sum.valorTotal ?? 0), lancamentos: item._count.id })),
    }}
  />
}
