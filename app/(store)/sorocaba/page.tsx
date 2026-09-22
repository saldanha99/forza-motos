import { redirect } from 'next/navigation'

/**
 * A pré-venda antiga de Sorocaba foi consolidada na experiência Pirelli.
 * Mantemos a rota para que QR codes e links já impressos não quebrem.
 */
export default function SorocabaPage() {
  redirect('/evento-pirelli/ofertas')
}
