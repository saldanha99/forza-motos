import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ConteudoEventoPirelli } from './_components/ConteudoEventoPirelli'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Experiência Pirelli + Forza Motos | Rodeo Lucky Friends',
  description: 'Caneca personalizada, produtos, quiz cronometrado e balanceamento na experiência Pirelli + Forza Motos.',
}

const ACOES_COM_CADASTRO = new Set(['quiz', 'balanceamento', 'caneca'])
const PARAMETROS_CAMPANHA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] : valor
}

export default async function EventoPirelliPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const parametros = await searchParams
  const acao = primeiro(parametros.acao)
  const recuperar = primeiro(parametros.recuperar) === '1'

  if (acao === 'ofertas') {
    const campanha = new URLSearchParams()
    for (const nome of PARAMETROS_CAMPANHA) {
      const valor = primeiro(parametros[nome])
      if (valor) campanha.set(nome, valor)
    }
    redirect(`/evento-pirelli/ofertas${campanha.size ? `?${campanha}` : ''}`)
  }

  if (acao && ACOES_COM_CADASTRO.has(acao)) {
    const destino = new URLSearchParams({ acao })
    if (recuperar) destino.set('recuperar', '1')
    for (const nome of PARAMETROS_CAMPANHA) {
      const valor = primeiro(parametros[nome])
      if (valor) destino.set(nome, valor)
    }
    redirect(`/evento-pirelli/cadastro?${destino}`)
  }

  if (recuperar) redirect('/evento-pirelli/cadastro?recuperar=1')

  return <ConteudoEventoPirelli pagina="landing" />
}
