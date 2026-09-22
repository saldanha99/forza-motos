'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  token: string
  statusInicial: 'PENDENTE' | 'PAGO' | 'CANCELADO'
}

/** Atualiza o retorno do Checkout Pro sem confiar nos parâmetros enviados pelo MP. */
export function AtualizarStatusEvento({ token, statusInicial }: Props) {
  const router = useRouter()
  const [verificando, setVerificando] = useState(statusInicial === 'PENDENTE')
  const tentativas = useRef(0)

  useEffect(() => {
    if (statusInicial !== 'PENDENTE') return
    let cancelado = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const consultar = async () => {
      if (cancelado) return
      tentativas.current += 1
      try {
        const resposta = await fetch(`/api/eventos/status?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
          headers: { accept: 'application/json' },
        })
        if (resposta.ok) {
          const dados = await resposta.json() as { status?: string }
          if (dados.status === 'PAGO' || dados.status === 'CANCELADO') {
            setVerificando(false)
            router.refresh()
            return
          }
        }
      } catch {
        // A página continua válida; uma falha transitória será tentada de novo.
      }

      if (!cancelado && tentativas.current < 20) {
        timer = setTimeout(consultar, 2_000)
      } else if (!cancelado) {
        setVerificando(false)
      }
    }

    timer = setTimeout(consultar, 700)
    return () => {
      cancelado = true
      if (timer) clearTimeout(timer)
    }
  }, [router, statusInicial, token])

  if (!verificando) return null
  return (
    <p className="mb-5 text-sm font-semibold text-amber-700" role="status" aria-live="polite">
      Verificando a confirmação do Mercado Pago…
    </p>
  )
}
