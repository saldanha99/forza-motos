import type { Metadata } from 'next'
import { ConteudoEventoPirelli } from '../_components/ConteudoEventoPirelli'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Quiz cronometrado | Pirelli × Forza Motos',
  description: 'Prepare-se e inicie conscientemente sua tentativa oficial no quiz Pirelli × Forza Motos.',
  robots: { index: false, follow: false },
}

export default function QuizEventoPirelliPage() {
  return <ConteudoEventoPirelli pagina="experiencia" acao="quiz" />
}
