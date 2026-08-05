import QRCode from 'qrcode'
import { obterEventoPirelli } from '@/lib/evento-pirelli'
import { AdminEventoPirelli } from '@/components/evento-pirelli/AdminEventoPirelli'
import { SITE_URL } from '@/lib/schema'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Evento Pirelli — Forza Admin' }

export default async function EventoPirelliAdminPage() {
  const evento = await obterEventoPirelli()
  const destinos = [
    { titulo: 'Cadastro', descricao: 'Entrada principal do stand', url: `${SITE_URL}/evento-pirelli` },
    { titulo: 'Quiz de pneus', descricao: 'Abre o quiz após identificar o visitante', url: `${SITE_URL}/evento-pirelli?acao=quiz` },
    { titulo: 'Promoções', descricao: 'Página de cadastro e atrações', url: `${SITE_URL}/evento-pirelli?acao=promocoes` },
  ]
  const qrs = await Promise.all(destinos.map(async (item) => ({ ...item, svg: await QRCode.toString(item.url, { type: 'svg', width: 220, margin: 1 }) })))
  return <AdminEventoPirelli evento={{ ...evento, dataInicio: evento.dataInicio?.toISOString() ?? null, dataFim: evento.dataFim?.toISOString() ?? null, valorMinimoPneus: Number(evento.valorMinimoPneus) }} qrs={qrs} />
}
