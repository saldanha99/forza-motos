import type { Metadata } from 'next'
import { ConteudoEventoPirelli } from '../_components/ConteudoEventoPirelli'
import type { AcaoCadastroEventoPirelli } from '@/components/evento-pirelli/EventoPirelliLanding'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Cadastro do participante | Pirelli × Forza Motos',
  description: 'Cadastre-se ou recupere seu acesso para participar das experiências Pirelli × Forza Motos.',
  robots: { index: false, follow: false },
}

const ACOES_CADASTRO = new Set<AcaoCadastroEventoPirelli>([
  'quiz',
  'balanceamento',
  'caneca',
])

export default async function CadastroEventoPirelliPage({ searchParams }: {
  searchParams: Promise<{ acao?: string; recuperar?: string }>
}) {
  const parametros = await searchParams
  const acao = ACOES_CADASTRO.has(parametros.acao as AcaoCadastroEventoPirelli)
    ? parametros.acao as AcaoCadastroEventoPirelli
    : undefined

  return (
    <ConteudoEventoPirelli
      pagina="cadastro"
      acao={acao}
      recuperarAcesso={parametros.recuperar === '1'}
    />
  )
}
