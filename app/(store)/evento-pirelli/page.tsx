import type { Metadata } from 'next'
import { obterEventoPirelli } from '@/lib/evento-pirelli'
import { EventoPirelliLanding } from '@/components/evento-pirelli/EventoPirelliLanding'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Evento Pirelli + Forza Motos', description: 'Quiz, atrações e brindes no evento Pirelli + Forza Motos.' }

export default async function EventoPirelliPage({ searchParams }: { searchParams: { acao?: string } }) {
  const evento = await obterEventoPirelli()
  return <EventoPirelliLanding evento={{ titulo: evento.titulo, descricao: evento.descricao, local: evento.local, dataInicio: evento.dataInicio?.toISOString() ?? null, logoForzaUrl: evento.logoForzaUrl, logoPirelliUrl: evento.logoPirelliUrl, logoCampneusUrl: evento.logoCampneusUrl, limiteNomeGravacao: evento.limiteNomeGravacao, valorMinimoPneus: Number(evento.valorMinimoPneus), ativo: evento.ativo, publicado: evento.publicado }} acao={searchParams.acao} />
}
