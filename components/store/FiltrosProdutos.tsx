'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Props {
  categorias: string[]
  marcas: string[]
  params: Record<string, string | undefined>
}

export function FiltrosProdutos({ categorias, marcas, params }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [busca, setBusca] = useState(params.busca ?? '')
  const [minPreco, setMinPreco] = useState(params.minPreco ?? '')
  const [maxPreco, setMaxPreco] = useState(params.maxPreco ?? '')

  function aplicar(novosFiltros: Record<string, string>) {
    const merged = { ...params, ...novosFiltros, page: '1' }
    const q = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => { if (v) q.set(k, v) })
    router.push(`${pathname}?${q.toString()}`)
  }

  function limpar() {
    setBusca('')
    setMinPreco('')
    setMaxPreco('')
    router.push(pathname)
  }

  return (
    <div className="bg-card border border-line rounded-xl p-5 space-y-5">
      <Input
        label="Buscar"
        placeholder="Nome ou modelo..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && aplicar({ busca })}
      />

      {categorias.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-faint mb-2.5 uppercase tracking-wider">Categoria</h3>
          <ul className="space-y-0.5">
            <li>
              <button
                onClick={() => aplicar({ categoria: '' })}
                className={`text-sm w-full text-left py-1.5 px-2 rounded-md transition-colors ${
                  !params.categoria ? 'text-vermelho bg-[var(--vermelho-light)] font-medium' : 'text-dim hover:text-ink hover:bg-card-hi'
                }`}
              >
                Todos
              </button>
            </li>
            {categorias.map((cat) => (
              <li key={cat}>
                <button
                  onClick={() => aplicar({ categoria: cat })}
                  className={`text-sm w-full text-left py-1.5 px-2 rounded-md transition-colors capitalize ${
                    params.categoria === cat ? 'text-vermelho bg-[var(--vermelho-light)] font-medium' : 'text-dim hover:text-ink hover:bg-card-hi'
                  }`}
                >
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {marcas.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-faint mb-2.5 uppercase tracking-wider">Marca</h3>
          <ul className="space-y-0.5">
            {marcas.map((marca) => (
              <li key={marca}>
                <button
                  onClick={() => aplicar({ marca })}
                  className={`text-sm w-full text-left py-1.5 px-2 rounded-md transition-colors ${
                    params.marca === marca ? 'text-vermelho bg-[var(--vermelho-light)] font-medium' : 'text-dim hover:text-ink hover:bg-card-hi'
                  }`}
                >
                  {marca}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-faint mb-2.5 uppercase tracking-wider">Faixa de Preço</h3>
        <div className="flex gap-2">
          <Input placeholder="Mín" type="number" value={minPreco} onChange={(e) => setMinPreco(e.target.value)} />
          <Input placeholder="Máx" type="number" value={maxPreco} onChange={(e) => setMaxPreco(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => aplicar({ minPreco, maxPreco })}>
          Aplicar
        </Button>
      </div>

      <Button variant="ghost" size="sm" className="w-full" onClick={limpar}>
        Limpar filtros
      </Button>
    </div>
  )
}
