'use client'
import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Search, ShoppingBag } from 'lucide-react'

type Candidato = { id: string; nomeCompleto: string; whatsapp: string; instagram: string | null; createdAt: string }

export function AtendimentoEventoPirelli({ codigoInicial }: { codigoInicial: string }) {
  const [busca, setBusca] = useState(codigoInicial)
  const [visitante, setVisitante] = useState<any>(null)
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const operacaoEmCurso = useRef(false)
  const vendaPendente = useRef<{ quantidade: number; referenciaVenda: string; chaveIdempotencia: string } | null>(null)

  // Busca inicial é deliberadamente única: o QR abriu esta tela com este código.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { input.current?.focus(); if (codigoInicial) consultar() }, [])

  async function consultar(e?: FormEvent) {
    e?.preventDefault()
    if (!busca.trim()) return
    setOcupado(true); setErro(''); setCandidatos(null)
    const resposta = await fetch(`/api/admin/evento-pirelli/atendimento?codigo=${encodeURIComponent(busca.trim())}`)
    const dados = await resposta.json()
    setOcupado(false)
    if (!resposta.ok) { setVisitante(null); setErro(dados.error); return }
    if (dados.multiplos) { setVisitante(null); setCandidatos(dados.multiplos); return }
    vendaPendente.current = null
    setVisitante(dados)
  }

  async function consultarPorId(id: string) {
    setOcupado(true); setErro('')
    const resposta = await fetch(`/api/admin/evento-pirelli/atendimento?id=${encodeURIComponent(id)}`)
    const dados = await resposta.json()
    setOcupado(false)
    if (!resposta.ok) { setErro(dados.error); return }
    vendaPendente.current = null
    setCandidatos(null)
    setVisitante(dados)
  }

  async function operar(acao: string, extra: any = {}) {
    if (!visitante || operacaoEmCurso.current) return false
    operacaoEmCurso.current = true
    setOcupado(true)
    setErro('')
    try {
      const resposta = await fetch('/api/admin/evento-pirelli/atendimento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitanteId: visitante.id, acao, ...extra }) })
      const dados = await resposta.json()
      if (!resposta.ok) { setErro(dados.error); return false }
      await consultarPorId(visitante.id)
      return true
    } catch {
      setErro('Falha de rede. Tente novamente; a operação anterior será reutilizada com segurança.')
      return false
    } finally {
      operacaoEmCurso.current = false
      setOcupado(false)
    }
  }

  async function venderCaneca() {
    if (!visitante || operacaoEmCurso.current) return
    if (!vendaPendente.current) {
      const quantidade = window.prompt('Quantidade de canecas compradas:', '1')
      if (!quantidade) return
      const referenciaVenda = window.prompt('Pedido/comprovante (opcional):') ?? ''
      vendaPendente.current = { quantidade: Number(quantidade), referenciaVenda, chaveIdempotencia: crypto.randomUUID() }
    }
    const concluiu = await operar('registrar-compra-caneca', vendaPendente.current)
    // Em falha, conserva exatamente a mesma chave/payload para o próximo retry.
    if (concluiu) vendaPendente.current = null
  }

  function validarCompraPneus() {
    if (!visitante || ocupado) return
    const valor = window.prompt('Subtotal apenas dos pneus (R$):')
    if (!valor) return
    const referenciaVenda = window.prompt('Pedido/comprovante (opcional):') ?? ''
    operar('validar-compra-pneus', { valorPneus: Number(valor), referenciaVenda })
  }

  return <main className="max-w-2xl mx-auto pb-20">
    <header className="mb-5">
      <Link href="/admin/evento-pirelli" className="text-sm text-brand-muted">← Evento Pirelli</Link>
      <h1 className="font-barlow font-black text-4xl text-brand-text mt-2">Atendimento rápido</h1>
      <p className="text-brand-muted">Escaneie o QR: ele abre esta tela já identificada. Também busca por nome ou telefone.</p>
    </header>
    <form onSubmit={consultar} className="flex gap-2">
      <input ref={input} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Escaneie ou busque…" className="flex-1 rounded-xl p-4 text-lg bg-brand-surface border border-brand-border text-brand-text"/>
      <button className="rounded-xl bg-brand-accent px-5 text-white"><Search/></button>
    </form>
    {erro && <p className="mt-3 rounded-lg bg-red-500/10 text-red-300 p-3">{erro}</p>}
    {ocupado && <p className="text-brand-muted mt-3">Atualizando…</p>}
    {candidatos && <section className="mt-5 rounded-2xl bg-brand-surface border border-brand-border divide-y divide-brand-border">
      <p className="p-4 text-sm text-brand-muted">{candidatos.length} visitantes encontrados — escolha quem está no balcão:</p>
      {candidatos.map((c) => <button key={c.id} onClick={() => consultarPorId(c.id)} className="w-full text-left p-4 hover:bg-brand-bg/40">
        <b className="text-brand-text">{c.nomeCompleto}</b><br/><span className="text-brand-muted text-sm">{c.whatsapp} {c.instagram ? `· @${c.instagram}` : ''}</span>
      </button>)}
    </section>}
    {visitante && <section className="mt-5 space-y-4">
      <div className="rounded-2xl bg-brand-surface border border-brand-border p-5">
        <p className="text-xs text-brand-muted uppercase tracking-widest">Visitante</p>
        <h2 className="font-barlow text-4xl font-black text-brand-text">{visitante.nomeCompleto}</h2>
        <p className="text-brand-muted">Caneca: <strong className="text-brand-text">{visitante.nomeGravacao}</strong> · {visitante.whatsapp}</p>
      </div>
      <div className="rounded-2xl bg-brand-surface border border-brand-border p-5">
        <p className="font-bold text-brand-text">Direitos</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {visitante.elegibilidadesCaneca.length ? visitante.elegibilidadesCaneca.map((item: any) => <span key={item.id} className="rounded-full bg-emerald-400/15 text-emerald-300 px-3 py-1 text-sm">{item.origem.replaceAll('_',' ')}</span>) : <span className="text-brand-muted">Nenhum brinde validado ainda.</span>}
        </div>
        {visitante.canecaBrinde && <>
          <p className="mt-4 text-sm text-brand-muted">Caneca brinde: <b className="text-brand-text">{visitante.canecaBrinde.status.replaceAll('_', ' ')}</b></p>
          {visitante.canecaBrinde.status !== 'CANCELADA' && <div className="grid grid-cols-2 gap-2 mt-3">
            {visitante.canecaBrinde.status !== 'PRONTA' && <button disabled={ocupado} onClick={() => operar('status-caneca', { status: 'EM_GRAVACAO' })} className="rounded-xl bg-[#333] p-4 text-white font-bold disabled:opacity-50">Iniciar gravação</button>}
            {visitante.canecaBrinde.status !== 'ENTREGUE' && <button disabled={ocupado} onClick={() => operar('status-caneca', { status: 'ENTREGUE' })} className="rounded-xl bg-emerald-600 p-4 text-white font-bold flex justify-center gap-2 disabled:opacity-50"><Check/> Entregar caneca</button>}
          </div>}
        </>}
      </div>
      <div className="rounded-2xl bg-brand-surface border border-brand-border p-5">
        <p className="font-bold text-brand-text">Venda no stand</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button disabled={ocupado} onClick={validarCompraPneus} className="rounded-xl border border-brand-border p-4 text-brand-text font-bold disabled:opacity-50">Validar compra de pneus</button>
          <button disabled={ocupado} onClick={venderCaneca} className="rounded-xl border border-brand-border p-4 text-brand-text font-bold flex items-center justify-center gap-2 disabled:opacity-50"><ShoppingBag size={18}/> Vender caneca</button>
        </div>
        <p className="text-xs text-brand-muted mt-3">Compra de caneca é registrada separadamente do brinde e pode ter mais de uma unidade.</p>
        {!!visitante.comprasCaneca?.length && <div className="mt-4 space-y-2">
          {visitante.comprasCaneca.map((compra: any) => <div key={compra.id} className="rounded-xl bg-brand-bg/40 p-3 flex items-center justify-between gap-3">
            <div><p className="text-brand-text font-bold">{compra.quantidade}x {compra.nomeGravacaoSnapshot}</p><p className="text-xs text-brand-muted">{compra.status.replaceAll('_',' ')}{compra.referenciaVenda ? ` · ${compra.referenciaVenda}` : ''}</p></div>
            {compra.status !== 'ENTREGUE' && compra.status !== 'CANCELADA' && <button disabled={ocupado} onClick={() => operar('status-compra-caneca', { compraId: compra.id, status: compra.status === 'PENDENTE' ? 'EM_GRAVACAO' : compra.status === 'EM_GRAVACAO' ? 'PRONTA' : 'ENTREGUE' })} className="rounded-lg bg-[#333] text-white text-sm px-3 py-2 disabled:opacity-50">Avançar</button>}
          </div>)}
        </div>}
      </div>
    </section>}
  </main>
}
