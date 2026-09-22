import { AtendimentoEventoPirelli } from '@/components/evento-pirelli/AtendimentoEventoPirelli'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'PDV e atendimento — Evento Pirelli' }
export default async function Page(props: { searchParams: Promise<{ codigo?: string; id?: string }> }) {
  const searchParams = await props.searchParams;
  return <AtendimentoEventoPirelli codigoInicial={searchParams.codigo ?? ''} visitanteIdInicial={searchParams.id ?? ''} />
}
