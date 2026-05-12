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
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={40} className="text-green-600" />
      </div>
      <h1 className="font-grotesk font-bold text-3xl text-ink mb-3">Pedido Confirmado!</h1>
      {numeroPedido && (
        <p className="text-dim mb-2">
          Número do pedido: <strong className="text-ink font-mono">{numeroPedido}</strong>
        </p>
      )}
      <p className="text-faint text-sm mb-10 leading-relaxed">
        Em breve você receberá atualizações por e-mail. Acompanhe o status do pedido pelo nosso rastreador.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {numeroPedido && (
          <Link href={`/rastrear?pedido=${numeroPedido}`}>
            <Button variant="surface">Rastrear Pedido</Button>
          </Link>
        )}
        <Link href="/produtos">
          <Button>Continuar Comprando</Button>
        </Link>
      </div>
    </div>
  )
}
