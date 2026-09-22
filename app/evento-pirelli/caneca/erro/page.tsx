import { StatusCheckoutCaneca } from '@/components/evento-pirelli/StatusCheckoutCaneca'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pagamento da caneca não concluído | Pirelli × Forza Motos' }

export default function ErroCanecaPage(props: { searchParams: Promise<{ token?: string }> }) {
  return <StatusCheckoutCaneca searchParams={props.searchParams} />
}
