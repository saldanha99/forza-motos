import type { Metadata } from 'next'
import { obterEventoPirelli } from '@/lib/evento-pirelli'
import { CheckoutCanecaEventoPirelli } from '@/components/evento-pirelli/CheckoutCanecaEventoPirelli'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Comprar caneca personalizada | Pirelli × Forza Motos',
  description: 'Compre sua caneca personalizada do Rodeo Lucky Friends pelo checkout seguro do Mercado Pago.',
  robots: { index: false, follow: false },
}

export default async function CheckoutCanecaPirelliPage() {
  const evento = await obterEventoPirelli()
  const agora = new Date()
  const encerrou = Boolean(evento.dataFim && agora > evento.dataFim)
  const vendasAbertas = evento.ativo && evento.publicado && !encerrou && (
    evento.vendasAntecipadasAbertas || !evento.dataInicio || agora >= evento.dataInicio
  )

  return (
    <CheckoutCanecaEventoPirelli
      tituloEvento={evento.titulo}
      local={evento.local}
      valorUnitario={Number(evento.valorCanecaAvulsa)}
      vendasAbertas={vendasAbertas}
      limiteNomeGravacao={evento.limiteNomeGravacao}
    />
  )
}
