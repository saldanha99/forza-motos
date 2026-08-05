'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Botao } from '@/components/admin/ui/primitives'

export function RefreshButton() {
  const router = useRouter()
  const [girando, setGirando] = useState(false)

  return (
    <Botao
      variante="secundario"
      onClick={() => {
        setGirando(true)
        router.refresh()
        setTimeout(() => setGirando(false), 800)
      }}
    >
      <RefreshCw size={14} className={girando ? 'animate-spin' : ''} />
      Atualizar
    </Botao>
  )
}
