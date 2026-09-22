import type { Metadata } from 'next'
import { ConteudoEventoPirelli } from '../_components/ConteudoEventoPirelli'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Produtos e ofertas | Pirelli × Forza Motos',
  description: 'Conheça os produtos participantes e as ofertas da experiência Pirelli × Forza Motos.',
}

export default function OfertasEventoPirelliPage() {
  return <ConteudoEventoPirelli pagina="ofertas" />
}
