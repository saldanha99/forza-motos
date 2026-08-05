import { AtendimentoEventoPirelli } from '@/components/evento-pirelli/AtendimentoEventoPirelli'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Atendimento — Evento Pirelli' }
export default function Page({ searchParams }: { searchParams: { codigo?: string } }) { return <AtendimentoEventoPirelli codigoInicial={searchParams.codigo ?? ''} /> }
