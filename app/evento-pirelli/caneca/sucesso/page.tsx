import { StatusCheckoutCaneca } from '@/components/evento-pirelli/StatusCheckoutCaneca'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pagamento da caneca | Pirelli × Forza Motos' }

export default function SucessoCanecaPage(props: { searchParams: Promise<{ token?: string }> }) {
  return <StatusCheckoutCaneca searchParams={props.searchParams} />
}
