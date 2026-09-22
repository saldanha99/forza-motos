import { StatusCheckoutCaneca } from '@/components/evento-pirelli/StatusCheckoutCaneca'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Confirmando pagamento da caneca | Pirelli × Forza Motos' }

export default function PendenteCanecaPage(props: { searchParams: Promise<{ token?: string }> }) {
  return <StatusCheckoutCaneca searchParams={props.searchParams} />
}
