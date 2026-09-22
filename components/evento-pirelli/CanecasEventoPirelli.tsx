'use client'
import Link from 'next/link'
import { useState } from 'react'

const ETAPAS = ['PENDENTE', 'EM_GRAVACAO', 'PRONTA', 'ENTREGUE'] as const
const FILTROS = [...ETAPAS, 'TODAS'] as const

const ROTULOS_PAGAMENTO: Record<string, string> = {
  PIX_MERCADO_PAGO: 'Pix Mercado Pago',
  MERCADO_PAGO: 'Mercado Pago (legado)',
  PIX_EXTERNO: 'Pix externo',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO_MAQUININHA: 'Crédito na maquininha',
  CARTAO_DEBITO_MAQUININHA: 'Débito na maquininha',
  OUTRO: 'Outro',
}

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ROTULOS_ORIGEM: Record<string, string> = {
  QUIZ_PERFEITO: 'Prêmio do quiz · sem pagamento',
  FOTO_VENCEDORA: 'Prêmio da foto · sem pagamento',
  COMPRA_PNEUS: 'Brinde por compra de pneus',
  MANUAL: 'Liberação manual',
}

export function CanecasEventoPirelli({ canecas: iniciais, compras: comprasIniciais, pendentesNome }: { canecas: any[]; compras: any[]; pendentesNome: any[] }) {
  const [canecas, setCanecas] = useState(iniciais)
  const [compras, setCompras] = useState(comprasIniciais)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('PENDENTE')
  const [aba, setAba] = useState<'brindes' | 'vendas'>('brindes')

  async function statusBrinde(visitanteId: string, novo: string) {
    setErro('')
    const r = await fetch('/api/admin/evento-pirelli/atendimento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitanteId, acao: 'status-caneca', status: novo }) })
    const dados = await r.json()
    if (r.ok) setCanecas((atuais) => atuais.map((c) => (c.visitanteId === visitanteId ? { ...c, ...dados } : c)))
    else setErro(dados.error ?? 'Não foi possível atualizar a caneca.')
  }

  async function statusVenda(visitanteId: string, compraId: string, novo: string) {
    setErro('')
    const r = await fetch('/api/admin/evento-pirelli/atendimento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitanteId, acao: 'status-compra-caneca', compraId, status: novo }) })
    const dados = await r.json()
    if (r.ok) setCompras((atuais) => atuais.map((c) => (c.id === compraId ? { ...c, ...dados } : c)))
    else setErro(dados.error ?? 'Não foi possível atualizar a venda.')
  }

  const brindesVisiveis = canecas.filter((c) => filtro === 'TODAS' || c.status === filtro)
  const vendasVisiveis = compras.filter((c) => filtro === 'TODAS' || c.status === filtro)

  return <main className="max-w-4xl mx-auto pb-20">
    <Link href="/admin/evento-pirelli" className="text-sm text-brand-muted">← Evento Pirelli</Link>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-barlow font-black text-4xl text-brand-text">Canecas e nomes para gravação</h1>
        <p className="mt-1 text-sm text-brand-muted">O prêmio do quiz não exige pagamento. Nas compras, aparecem somente registros com pagamento confirmado.</p>
      </div>
      <Link href="/api/admin/evento-pirelli/export?tipo=canecas" className="rounded-xl border border-brand-border px-4 py-3 text-sm font-bold text-brand-text">Baixar lista para impressão</Link>
    </div>
    {erro && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-300">{erro}</p>}
    <div className="flex gap-2 mt-4">
      <button onClick={() => setAba('brindes')} className={`rounded-full px-4 py-2 text-sm ${aba === 'brindes' ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-muted'}`}>Prêmios e brindes confirmados ({canecas.length + pendentesNome.length})</button>
      <button onClick={() => setAba('vendas')} className={`rounded-full px-4 py-2 text-sm ${aba === 'vendas' ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-muted'}`}>Compras confirmadas ({compras.length})</button>
    </div>
    <div className="flex gap-2 overflow-auto mt-4">{FILTROS.map((f) => <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-4 py-2 text-sm ${filtro === f ? 'bg-brand-accent text-white' : 'bg-brand-surface text-brand-muted'}`}>{f.replaceAll('_', ' ')}</button>)}</div>

    {aba === 'brindes' && <div className="grid gap-3 mt-5">
      {(filtro === 'PENDENTE' || filtro === 'TODAS') && pendentesNome.map((visitante) => <article key={visitante.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Aguardando nome da gravação</p>
          <p className="mt-1 font-barlow text-2xl font-black text-brand-text">{visitante.nomeCompleto}</p>
          <p className="text-sm text-brand-muted">{visitante.whatsapp} · {visitante.elegibilidadesCaneca.map((item: any) => ROTULOS_ORIGEM[item.origem] ?? item.origem).join(' · ')}</p>
        </div>
        <Link href={`/admin/evento-pirelli/atendimento?id=${encodeURIComponent(visitante.id)}`} className="rounded-xl bg-brand-accent px-4 py-3 text-sm font-bold text-white">Abrir ficha e definir nome</Link>
      </article>)}
      {brindesVisiveis.map((c) => <article key={c.id} className="rounded-2xl bg-brand-surface border border-brand-border p-5 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <p className="font-barlow font-black text-3xl text-brand-text">{c.nomeGravacaoSnapshot}</p>
          <p className="text-sm text-brand-muted">{c.visitante.nomeCompleto} · {c.visitante.whatsapp}</p>
          <p className="text-xs text-emerald-300 mt-2">{c.elegibilidades.map((e: any) => ROTULOS_ORIGEM[e.origem] ?? e.origem.replaceAll('_', ' ')).join(' · ')}</p>
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
          <p className="font-barlow font-black text-3xl text-brand-text">{c.quantidade}x {c.nomeGravacaoSnapshot || 'aguardando nome'}</p>
          <p className="text-sm text-brand-muted">{c.visitante?.nomeCompleto ?? 'Sem visitante vinculado'} {c.visitante?.whatsapp ? `· ${c.visitante.whatsapp}` : ''}</p>
          <p className="mt-2 text-xs text-emerald-300">{c.formaPagamento ? ROTULOS_PAGAMENTO[c.formaPagamento] ?? c.formaPagamento : 'Forma não informada'}{c.valorPago ? ` · ${moeda(c.valorPago)}` : ''}</p>
          {c.pagamentoConfirmadoEm && <p className="mt-1 text-xs text-brand-muted">Pago em {new Date(c.pagamentoConfirmadoEm).toLocaleString('pt-BR')} · conferido por {c.pagamentoConfirmadoPor ?? 'Equipe'}</p>}
          {(c.referenciaPagamento || c.referenciaVenda) && <p className="text-xs text-brand-muted mt-1">Ref.: {c.referenciaPagamento || c.referenciaVenda}</p>}
          {!c.nomeGravacaoSnapshot && <p className="mt-2 text-xs font-bold text-amber-300">O WhatsApp de confirmação já foi enviado; não inicie a gravação antes do nome aparecer aqui.</p>}
        </div>
        <div className="flex gap-2">
          {c.status === 'PENDENTE' && c.nomeGravacaoSnapshot && <button onClick={() => statusVenda(c.visitanteId, c.id, 'EM_GRAVACAO')} className="rounded-xl bg-[#333] text-white px-4 py-3">Gravar</button>}
          {c.status === 'PENDENTE' && !c.nomeGravacaoSnapshot && c.visitanteId && <Link href={`/admin/evento-pirelli/atendimento?id=${encodeURIComponent(c.visitanteId)}`} className="rounded-xl border border-brand-border px-4 py-3 text-sm font-bold text-brand-text">Abrir cliente</Link>}
          {c.status === 'EM_GRAVACAO' && <button onClick={() => statusVenda(c.visitanteId, c.id, 'PRONTA')} className="rounded-xl bg-[#996f00] text-white px-4 py-3">Pronta</button>}
          {c.status === 'PRONTA' && <button onClick={() => statusVenda(c.visitanteId, c.id, 'ENTREGUE')} className="rounded-xl bg-emerald-600 text-white px-4 py-3">Entregar</button>}
        </div>
      </article>)}
      {!vendasVisiveis.length && <p className="text-brand-muted p-6">Nenhuma venda nesta etapa.</p>}
    </div>}
  </main>
}
