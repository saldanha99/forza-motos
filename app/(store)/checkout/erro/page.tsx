import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function CheckoutErroPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertCircle size={40} className="text-red-600" />
      </div>
      <h1 className="font-grotesk font-bold text-3xl text-ink mb-3">Pagamento não concluído</h1>
      <p className="text-faint text-sm mb-10 leading-relaxed">
        Nenhum pedido será tratado como pago sem a confirmação do Mercado Pago. Você pode retornar ao checkout e tentar novamente.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/checkout"><Button>Tentar novamente</Button></Link>
        <Link href="/produtos"><Button variant="surface">Voltar à loja</Button></Link>
      </div>
    </div>
  )
}
