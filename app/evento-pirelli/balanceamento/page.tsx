import type { Metadata } from 'next'
import { ConteudoEventoPirelli } from '../_components/ConteudoEventoPirelli'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Balanceamento na prática | Pirelli × Forza Motos',
  description: 'Participe da demonstração de balanceamento Pirelli × Forza Motos.',
  robots: { index: false, follow: false },
}

export default function BalanceamentoEventoPirelliPage() {
  return <ConteudoEventoPirelli pagina="experiencia" acao="balanceamento" />
}
