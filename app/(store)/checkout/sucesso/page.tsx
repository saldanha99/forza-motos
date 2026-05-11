import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { CheckCircle } from 'lucide-react'

export default function CheckoutSucessoPage({
  searchParams,
}: {
  searchParams: { pedido?: string; payment_id?: string }
}) {
  const numeroPedido = searchParams.pedido

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <CheckCircle size={64} className="mx-auto text-green-500 mb-6" />
      <h1 className="font-rajdhani font-bold text-4xl text-white mb-3">Pedido Confirmado!</h1>
      {numeroPedido && (
        <p className="text-zinc-400 mb-2">
          Número do pedido: <strong className="text-white">{numeroPedido}</strong>
        </p>
      )}
      <p className="text-zinc-500 text-sm mb-10">
        Em breve você receberá atualizações por e-mail. Acompanhe o status do pedido pelo nosso rastreador.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {numeroPedido && (
          <Link href={`/rastrear?pedido=${numeroPedido}`}>
            <Button variant="outline">Rastrear Pedido</Button>
          </Link>
        )}
        <Link href="/produtos">
          <Button>Continuar Comprando</Button>
        </Link>
      </div>
    </div>
  )
}
