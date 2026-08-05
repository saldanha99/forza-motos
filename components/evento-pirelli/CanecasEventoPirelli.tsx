'use client'
import Link from 'next/link'
import { useState } from 'react'

const ETAPAS = ['PENDENTE', 'EM_GRAVACAO', 'PRONTA', 'ENTREGUE'] as const
const FILTROS = [...ETAPAS, 'TODAS'] as const

export function CanecasEventoPirelli({ canecas: iniciais, compras: comprasIniciais }: { canecas: any[]; compras: any[] }) {
  const [canecas, setCanecas] = useState(iniciais)
  const [compras, setCompras] = useState(comprasIniciais)
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('PENDENTE')
  const [aba, setAba] = useState<'brindes' | 'vendas'>('brindes')

  async function statusBrinde(visitanteId: string, novo: string) {
    const r = await fetch('/api/admin/evento-pirelli/atendimento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitanteId, acao: 'status-caneca', status: novo }) })
    if (r.ok) setCanecas(canecas.map((c) => (c.visitanteId === visitanteId ? { ...c, status: novo } : c)))
  }

  async function statusVenda(visitanteId: string, compraId: string, novo: string) {
    const r = await fetch('/api/admin/evento-pirelli/atendimento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitanteId, acao: 'status-compra-caneca', compraId, status: novo }) })
    if (r.ok) setCompras(compras.map((c) => (c.id === compraId ? { ...c, status: novo } : c)))
  }

  const brindesVisiveis = canecas.filter((c) => filtro === 'TODAS' || c.status === filtro)
  const vendasVisiveis = compras.filter((c) => filtro === 'TODAS' || c.status === filtro)

  return <main className="max-w-4xl mx-auto pb-20">
    <Link href="/admin/evento-pirelli" className="text-sm text-brand-muted">← Evento Pirelli</Link>
    <h1 className="font-barlow font-black text-4xl text-brand-text mt-2">Fila de gravação</h1>
    <div className="flex gap-2 mt-4">
      <button onClick={() => setAba('brindes')} className={`rounded-full px-4 py-2 text-sm ${aba === 'brindes' ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-muted'}`}>Brindes ({canecas.length})</button>
      <button onClick={() => setAba('vendas')} className={`rounded-full px-4 py-2 text-sm ${aba === 'vendas' ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-muted'}`}>Vendas ({compras.length})</button>
    </div>
    <div className="flex gap-2 overflow-auto mt-4">{FILTROS.map((f) => <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-4 py-2 text-sm ${filtro === f ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-muted'}`}>{f.replaceAll('_', ' ')}</button>)}</div>

    {aba === 'brindes' && <div className="grid gap-3 mt-5">
      {brindesVisiveis.map((c) => <article key={c.id} className="rounded-2xl bg-brand-surface border border-brand-border p-5 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <p className="font-barlow font-black text-3xl text-brand-text">{c.nomeGravacaoSnapshot}</p>
          <p className="text-sm text-brand-muted">{c.visitante.nomeCompleto} · {c.visitante.whatsapp}</p>
          <p className="text-xs text-emerald-300 mt-2">{c.elegibilidades.map((e: any) => e.origem.replaceAll('_', ' ')).join(' · ')}</p>
        </div>
        <div className="flex gap-2">
          {c.status === 'PENDENTE' && <button onClick={() => statusBrinde(c.visitanteId, 'EM_GRAVACAO')} className="rounded-xl bg-[#333] text-white px-4 py-3">Gravar</button>}
          {c.status === 'EM_GRAVACAO' && <button onClick={() => statusBrinde(c.visitanteId, 'PRONTA')} className="rounded-xl bg-[#996f00] text-white px-4 py-3">Pronta</button>}
          {c.status === 'PRONTA' && <button onClick={() => statusBrinde(c.visitanteId, 'ENTREGUE')} className="rounded-xl bg-emerald-600 text-white px-4 py-3">Entregar</button>}
        </div>
      </article>)}
      {!brindesVisiveis.length && <p className="text-brand-muted p-6">Nenhuma caneca nesta etapa.</p>}
    </div>}

    {aba === 'vendas' && <div className="grid gap-3 mt-5">
      {vendasVisiveis.map((c) => <article key={c.id} className="rounded-2xl bg-brand-surface border border-brand-border p-5 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <p className="font-barlow font-black text-3xl text-brand-text">{c.quantidade}x {c.nomeGravacaoSnapshot}</p>
          <p className="text-sm text-brand-muted">{c.visitante?.nomeCompleto ?? 'Sem visitante vinculado'} {c.visitante?.whatsapp ? `· ${c.visitante.whatsapp}` : ''}</p>
          {c.referenciaVenda && <p className="text-xs text-brand-muted mt-2">Ref.: {c.referenciaVenda}</p>}
        </div>
        <div className="flex gap-2">
          {c.status === 'PENDENTE' && <button onClick={() => statusVenda(c.visitanteId, c.id, 'EM_GRAVACAO')} className="rounded-xl bg-[#333] text-white px-4 py-3">Gravar</button>}
          {c.status === 'EM_GRAVACAO' && <button onClick={() => statusVenda(c.visitanteId, c.id, 'PRONTA')} className="rounded-xl bg-[#996f00] text-white px-4 py-3">Pronta</button>}
          {c.status === 'PRONTA' && <button onClick={() => statusVenda(c.visitanteId, c.id, 'ENTREGUE')} className="rounded-xl bg-emerald-600 text-white px-4 py-3">Entregar</button>}
        </div>
      </article>)}
      {!vendasVisiveis.length && <p className="text-brand-muted p-6">Nenhuma venda nesta etapa.</p>}
    </div>}
  </main>
}
