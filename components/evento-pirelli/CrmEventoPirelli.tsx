'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Check, CheckCircle2, Clock3, Coffee, Download, ExternalLink, RefreshCw, Search, ShoppingBag, UserRound, Users, XCircle } from 'lucide-react'

type StatusCaneca = 'PENDENTE' | 'EM_GRAVACAO' | 'PRONTA' | 'ENTREGUE' | 'CANCELADA'
type Filtro = 'TODOS' | 'COMPRA_PNEUS' | 'SEM_NOME' | 'PRODUCAO' | 'PENDENTE' | 'EM_GRAVACAO' | 'PRONTA' | 'ENTREGUE'

type VisitanteCrm = {
  id: string
  codigoQr: string
  nomeCompleto: string
  whatsapp: string
  email: string | null
  nomeGravacao: string | null
  motoMarca: string | null
  motoModelo: string | null
  motoAno: number | null
  createdAt: string
  canecaBrinde: null | {
    id: string
    status: StatusCaneca
    nomeGravacaoSnapshot: string
    entregueEm: string | null
    entreguePor: string | null
  }
  elegibilidadesCaneca: Array<{
    id: string
    origem: 'QUIZ_PERFEITO' | 'FOTO_VENCEDORA' | 'COMPRA_PNEUS' | 'MANUAL'
    valorPneus: number | null
    formaPagamento: string | null
    pagamentoConfirmadoEm: string | null
    pagamentoConfirmadoPor: string | null
    referenciaPagamento: string | null
    referenciaVenda: string | null
    validadoEm: string
    validadoPor: string | null
  }>
  comprasCaneca: Array<{ id: string; status: StatusCaneca; quantidade: number; valorPago: number | null }>
  lancamentosCaixa: Array<{ id: string; tipo: 'VENDA_CANECA' | 'COMPRA_PNEUS'; valorTotal: number; formaPagamento: string; confirmadoEm: string }>
  pedidos: Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string }>
}

const FILTROS: Array<{ valor: Filtro; rotulo: string }> = [
  { valor: 'TODOS', rotulo: 'Todos' },
  { valor: 'COMPRA_PNEUS', rotulo: 'Comprou +R$ 899' },
  { valor: 'SEM_NOME', rotulo: 'Falta nome' },
  { valor: 'PRODUCAO', rotulo: 'Todas em produção' },
  { valor: 'PENDENTE', rotulo: 'Aguardando gravação' },
  { valor: 'EM_GRAVACAO', rotulo: 'Em gravação' },
  { valor: 'PRONTA', rotulo: 'Prontas para entregar' },
  { valor: 'ENTREGUE', rotulo: 'Entregues' },
]

const ROTULOS_PAGAMENTO: Record<string, string> = {
  PIX_MERCADO_PAGO: 'Pix Mercado Pago',
  MERCADO_PAGO: 'Mercado Pago',
  PIX_EXTERNO: 'Pix externo',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO_MAQUININHA: 'Crédito na maquininha',
  CARTAO_DEBITO_MAQUININHA: 'Débito na maquininha',
  OUTRO: 'Outro',
}

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function compraPneus(visitante: VisitanteCrm) {
  return visitante.elegibilidadesCaneca.find((item) => item.origem === 'COMPRA_PNEUS') ?? null
}

function situacaoCaneca(visitante: VisitanteCrm) {
  if (!visitante.elegibilidadesCaneca.length) return 'SEM_DIREITO'
  if (!visitante.nomeGravacao) return 'SEM_NOME'
  return visitante.canecaBrinde?.status ?? 'PENDENTE'
}

function rotuloSituacao(visitante: VisitanteCrm) {
  const situacao = situacaoCaneca(visitante)
  if (situacao === 'SEM_DIREITO') return 'Sem direito liberado'
  if (situacao === 'SEM_NOME') return 'Aguardando nome da caneca'
  if (situacao === 'PENDENTE') return 'Aguardando gravação'
  if (situacao === 'EM_GRAVACAO') return 'Em gravação'
  if (situacao === 'PRONTA') return 'Pronta para entregar'
  if (situacao === 'ENTREGUE') return 'Entregue'
  return 'Cancelada'
}

function classeSituacao(visitante: VisitanteCrm) {
  const situacao = situacaoCaneca(visitante)
  if (situacao === 'ENTREGUE') return 'border-brand-success/30 bg-brand-success/10 text-brand-success'
  if (situacao === 'PRONTA') return 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent'
  if (situacao === 'SEM_NOME' || situacao === 'PENDENTE') return 'border-brand-warning/30 bg-brand-warning/10 text-brand-warning'
  if (situacao === 'CANCELADA') return 'border-brand-danger/30 bg-brand-danger/10 text-brand-danger'
  return 'border-brand-border bg-brand-bg/40 text-brand-muted'
}

export function CrmEventoPirelli({ visitantes: iniciais, valorMinimoPneus }: { visitantes: VisitanteCrm[]; valorMinimoPneus: number }) {
  const router = useRouter()
  const [visitantes, setVisitantes] = useState(iniciais)
  const [filtro, setFiltro] = useState<Filtro>('COMPRA_PNEUS')
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [atualizando, iniciarAtualizacao] = useTransition()
  const [atualizadoEm, setAtualizadoEm] = useState(() => new Date())

  useEffect(() => {
    setVisitantes(iniciais)
    setAtualizadoEm(new Date())
  }, [iniciais])

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      iniciarAtualizacao(() => router.refresh())
    }, 15_000)
    return () => window.clearInterval(intervalo)
  }, [router])

  function atualizarAgora() {
    iniciarAtualizacao(() => router.refresh())
  }

  const contagens = useMemo(() => ({
    todos: visitantes.length,
    compraPneus: visitantes.filter((item) => compraPneus(item)).length,
    semNome: visitantes.filter((item) => compraPneus(item) && situacaoCaneca(item) === 'SEM_NOME').length,
    emProducao: visitantes.filter((item) => ['PENDENTE', 'EM_GRAVACAO'].includes(situacaoCaneca(item))).length,
    prontas: visitantes.filter((item) => situacaoCaneca(item) === 'PRONTA').length,
    entregues: visitantes.filter((item) => situacaoCaneca(item) === 'ENTREGUE').length,
  }), [visitantes])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return visitantes.filter((visitante) => {
      const situacao = situacaoCaneca(visitante)
      const bateFiltro = filtro === 'TODOS'
        || (filtro === 'COMPRA_PNEUS' && Boolean(compraPneus(visitante)))
        || (filtro === 'SEM_NOME' && visitante.elegibilidadesCaneca.length > 0 && situacao === 'SEM_NOME')
        || (filtro === 'PRODUCAO' && ['PENDENTE', 'EM_GRAVACAO'].includes(situacao))
        || situacao === filtro
      const conteudo = `${visitante.nomeCompleto} ${visitante.whatsapp} ${visitante.email ?? ''} ${visitante.nomeGravacao ?? ''}`.toLocaleLowerCase('pt-BR')
      return bateFiltro && (!termo || conteudo.includes(termo))
    })
  }, [busca, filtro, visitantes])

  async function operar(visitante: VisitanteCrm, acao: string, extra: Record<string, unknown>) {
    setOcupado(visitante.id)
    setErro('')
    const resposta = await fetch('/api/admin/evento-pirelli/atendimento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitanteId: visitante.id, acao, ...extra }),
    })
    const dados = await resposta.json()
    setOcupado(null)
    if (!resposta.ok) {
      setErro(dados.error ?? 'Não foi possível atualizar.')
      return false
    }
    return true
  }

  async function definirNome(visitante: VisitanteCrm) {
    const nomeGravacao = window.prompt('Digite exatamente o nome que será gravado na caneca:', visitante.nomeGravacao ?? '')?.trim()
    if (!nomeGravacao) return
    if (await operar(visitante, 'definir-nome-caneca', { nomeGravacao })) {
      setVisitantes((atuais) => atuais.map((item) => item.id === visitante.id ? {
        ...item,
        nomeGravacao,
        canecaBrinde: item.canecaBrinde ?? { id: `local-${item.id}`, status: 'PENDENTE', nomeGravacaoSnapshot: nomeGravacao, entregueEm: null, entreguePor: null },
      } : item))
    }
  }

  async function mudarStatus(visitante: VisitanteCrm, status: StatusCaneca) {
    if (status === 'ENTREGUE' && !window.confirm(`Confirmar que a caneca de ${visitante.nomeCompleto} foi entregue?`)) return
    if (!visitante.canecaBrinde && visitante.nomeGravacao) {
      const criouCaneca = await operar(visitante, 'definir-nome-caneca', { nomeGravacao: visitante.nomeGravacao })
      if (!criouCaneca) return
    }
    if (await operar(visitante, 'status-caneca', { status })) {
      setVisitantes((atuais) => atuais.map((item) => {
        if (item.id !== visitante.id) return item
        const caneca = item.canecaBrinde ?? { id: `local-${item.id}`, status: 'PENDENTE' as StatusCaneca, nomeGravacaoSnapshot: item.nomeGravacao ?? '', entregueEm: null, entreguePor: null }
        return { ...item, canecaBrinde: { ...caneca, status } }
      }))
    }
  }

  function proximaAcao(visitante: VisitanteCrm) {
    if (!visitante.elegibilidadesCaneca.length) return null
    if (!visitante.nomeGravacao) return <button disabled={ocupado === visitante.id} onClick={() => void definirNome(visitante)} className="rounded-xl bg-brand-accent px-4 py-3 text-sm font-bold text-brand-on-accent disabled:opacity-50">Definir nome</button>
    if (!visitante.canecaBrinde || visitante.canecaBrinde.status === 'PENDENTE') return <button disabled={ocupado === visitante.id} onClick={() => void mudarStatus(visitante, 'EM_GRAVACAO')} className="rounded-xl bg-brand-text px-4 py-3 text-sm font-bold text-brand-bg disabled:opacity-50">Iniciar gravação</button>
    if (visitante.canecaBrinde.status === 'EM_GRAVACAO') return <button disabled={ocupado === visitante.id} onClick={() => void mudarStatus(visitante, 'PRONTA')} className="rounded-xl bg-brand-accent px-4 py-3 text-sm font-bold text-brand-on-accent disabled:opacity-50">Marcar como pronta</button>
    if (visitante.canecaBrinde.status === 'PRONTA') return <button disabled={ocupado === visitante.id} onClick={() => void mudarStatus(visitante, 'ENTREGUE')} className="inline-flex items-center gap-2 rounded-xl bg-brand-success px-4 py-3 text-sm font-bold text-brand-on-accent disabled:opacity-50"><Check size={16} /> Confirmar entrega</button>
    return null
  }

  return <main className="mx-auto max-w-7xl pb-20">
    <Link href="/admin/evento-pirelli" className="text-sm text-brand-muted">← Evento Pirelli</Link>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Gestão completa da jornada</p>
        <h1 className="font-barlow text-4xl font-black text-brand-text">CRM do Evento Pirelli</h1>
        <p className="mt-1 max-w-3xl text-brand-muted">A compra paga acima de {moeda(valorMinimoPneus)} libera o direito; depois você acompanha nome, gravação e entrega sem procurar participante por participante.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={atualizarAgora} disabled={atualizando} className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm font-bold text-brand-text disabled:opacity-50"><RefreshCw size={17} className={atualizando ? 'animate-spin' : ''} /> Atualizar</button>
        <a href="/api/admin/evento-pirelli/export?tipo=operacao" className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm font-bold text-brand-text"><Download size={17} /> Exportar operação</a>
      </div>
    </div>

    <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
      {[
        ['Participantes', contagens.todos, 'TODOS' as Filtro, Users],
        ['Comprou +899', contagens.compraPneus, 'COMPRA_PNEUS' as Filtro, ShoppingBag],
        ['Falta nome', contagens.semNome, 'SEM_NOME' as Filtro, UserRound],
        ['Em produção', contagens.emProducao, 'PRODUCAO' as Filtro, Clock3],
        ['Prontas', contagens.prontas, 'PRONTA' as Filtro, Coffee],
        ['Entregues', contagens.entregues, 'ENTREGUE' as Filtro, CheckCircle2],
      ].map(([rotulo, valor, destino, Icon]: any) => <button key={rotulo} onClick={() => setFiltro(destino)} className={`rounded-2xl border p-4 text-left ${filtro === destino ? 'border-brand-accent bg-brand-accent/10' : 'border-brand-border bg-brand-surface'}`}>
        <Icon size={18} className="text-brand-accent" />
        <p className="mt-3 font-barlow text-3xl font-black text-brand-text">{valor}</p>
        <p className="text-xs text-brand-muted">{rotulo}</p>
      </button>)}
    </section>

    <section className="mt-5 rounded-2xl border border-brand-border bg-brand-surface p-4">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
        <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Filtrar por nome, WhatsApp, e-mail ou nome da caneca" className="w-full rounded-xl border border-brand-border bg-brand-bg py-3 pl-11 pr-4 text-brand-text outline-none focus:border-brand-accent" />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{FILTROS.map((item) => <button key={item.valor} onClick={() => setFiltro(item.valor)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filtro === item.valor ? 'bg-brand-accent text-brand-on-accent' : 'border border-brand-border text-brand-muted'}`}>{item.rotulo}</button>)}</div>
      <p className="mt-3 text-xs text-brand-muted">Atualização automática a cada 15 segundos · última leitura às {atualizadoEm.toLocaleTimeString('pt-BR')}</p>
    </section>

    {erro && <p className="mt-4 rounded-xl border border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-brand-danger">{erro}</p>}

    <div className="mt-5 grid gap-4">
      {visiveis.map((visitante) => {
        const direitoPneus = compraPneus(visitante)
        return <article key={visitante.id} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-barlow text-2xl font-black text-brand-text">{visitante.nomeCompleto}</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${classeSituacao(visitante)}`}>{rotuloSituacao(visitante)}</span>
              </div>
              <p className="mt-1 text-sm text-brand-muted">{visitante.whatsapp}{visitante.email ? ` · ${visitante.email}` : ''}</p>
              {visitante.motoMarca && <p className="mt-1 text-xs text-brand-muted">Moto: {visitante.motoMarca} {visitante.motoModelo} · {visitante.motoAno ?? 'ano não informado'}</p>}
            </div>
            <Link href={`/admin/evento-pirelli/atendimento?codigo=${encodeURIComponent(visitante.codigoQr)}`} className="inline-flex items-center gap-2 rounded-xl border border-brand-border px-4 py-3 text-sm font-bold text-brand-text"><ExternalLink size={16} /> Abrir ficha</Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-brand-border bg-brand-bg/35 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">1. Direito à caneca</p>
              {direitoPneus ? <>
                <p className="mt-2 font-bold text-brand-success">Compra de pneus confirmada</p>
                <p className="mt-1 text-sm text-brand-text">{moeda(direitoPneus.valorPneus ?? 0)}</p>
                <p className="mt-1 text-xs text-brand-muted">{direitoPneus.formaPagamento ? ROTULOS_PAGAMENTO[direitoPneus.formaPagamento] ?? direitoPneus.formaPagamento : 'Pagamento confirmado'}{direitoPneus.referenciaPagamento ? ` · Ref. ${direitoPneus.referenciaPagamento}` : ''}</p>
                <p className="mt-1 text-xs text-brand-muted">Validado por {direitoPneus.pagamentoConfirmadoPor ?? direitoPneus.validadoPor ?? 'Sistema'}</p>
              </> : visitante.elegibilidadesCaneca.length ? <p className="mt-2 text-sm font-bold text-brand-success">Liberado por {visitante.elegibilidadesCaneca.map((item) => item.origem.replaceAll('_', ' ')).join(', ')}</p> : <p className="mt-2 text-sm text-brand-muted">Nenhum direito liberado.</p>}
            </div>

            <div className="rounded-xl border border-brand-border bg-brand-bg/35 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">2. Personalização</p>
              <p className={`mt-2 font-barlow text-2xl font-black ${visitante.nomeGravacao ? 'text-brand-text' : 'text-brand-warning'}`}>{visitante.nomeGravacao ?? 'Nome pendente'}</p>
              <p className="mt-1 text-xs text-brand-muted">{visitante.nomeGravacao ? 'Nome confirmado para gravação.' : 'Defina o nome antes de iniciar a produção.'}</p>
            </div>

            <div className="rounded-xl border border-brand-border bg-brand-bg/35 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">3. Produção e entrega</p>
              <p className="mt-2 font-bold text-brand-text">{rotuloSituacao(visitante)}</p>
              {visitante.canecaBrinde?.entregueEm && <p className="mt-1 text-xs text-brand-muted">{new Date(visitante.canecaBrinde.entregueEm).toLocaleString('pt-BR')} · {visitante.canecaBrinde.entreguePor ?? 'Equipe'}</p>}
              <div className="mt-3">{proximaAcao(visitante)}</div>
            </div>
          </div>

          {visitante.comprasCaneca.length > 0 && <p className="mt-3 text-xs text-brand-muted">Também possui {visitante.comprasCaneca.reduce((total, item) => total + item.quantidade, 0)} caneca(s) comprada(s) separadamente. Acompanhe-as na fila de Canecas.</p>}
        </article>
      })}
      {!visiveis.length && <div className="rounded-2xl border border-brand-border bg-brand-surface p-10 text-center"><XCircle className="mx-auto text-brand-muted" /><p className="mt-3 font-bold text-brand-text">Nenhum participante neste filtro</p><p className="text-sm text-brand-muted">Altere o filtro ou a busca acima.</p></div>}
    </div>
  </main>
}
