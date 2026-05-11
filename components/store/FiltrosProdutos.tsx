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
    <div className="space-y-6">
      {/* Busca */}
      <div>
        <Input
          label="Buscar"
          placeholder="Nome ou modelo de moto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && aplicar({ busca })}
        />
      </div>

      {/* Categorias */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wide">Categoria</h3>
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => aplicar({ categoria: '' })}
              className={`text-sm w-full text-left py-1 px-2 rounded transition-colors ${
                !params.categoria ? 'text-vermelho bg-vermelho/10' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Todos
            </button>
          </li>
          {categorias.map((cat) => (
            <li key={cat}>
              <button
                onClick={() => aplicar({ categoria: cat })}
                className={`text-sm w-full text-left py-1 px-2 rounded transition-colors capitalize ${
                  params.categoria === cat ? 'text-vermelho bg-vermelho/10' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Marcas */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wide">Marca</h3>
        <ul className="space-y-1">
          {marcas.map((marca) => (
            <li key={marca}>
              <button
                onClick={() => aplicar({ marca })}
                className={`text-sm w-full text-left py-1 px-2 rounded transition-colors ${
                  params.marca === marca ? 'text-vermelho bg-vermelho/10' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {marca}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Faixa de preço */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wide">Preço</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Mín"
            type="number"
            value={minPreco}
            onChange={(e) => setMinPreco(e.target.value)}
            className="w-20"
          />
          <Input
            placeholder="Máx"
            type="number"
            value={maxPreco}
            onChange={(e) => setMaxPreco(e.target.value)}
            className="w-20"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={() => aplicar({ minPreco, maxPreco })}
        >
          Aplicar
        </Button>
      </div>

      <Button variant="ghost" size="sm" className="w-full" onClick={limpar}>
        Limpar filtros
      </Button>
    </div>
  )
}
