'use client'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, Check, Clock3, CreditCard, PackageCheck, Search, ShoppingBag, Trophy, UserPlus, Wrench, X } from 'lucide-react'
import { novaChaveIdempotenciaCliente } from '@/lib/checkout/chave-idempotencia-cliente'
import { DESAFIO_FOTO_ATIVO } from '@/lib/evento-pirelli/config'

type Candidato = { id: string; nomeCompleto: string; whatsapp: string; instagram: string | null; createdAt: string }
type FormaPagamento = 'PIX_EXTERNO' | 'DINHEIRO' | 'CARTAO_CREDITO_MAQUININHA' | 'CARTAO_DEBITO_MAQUININHA' | 'OUTRO'
type Caixa = {
  tipo: 'caneca' | 'pneus'
  quantidade: string
  valorPneus: string
  formaPagamento: FormaPagamento
  referenciaVenda: string
  chaveIdempotencia: string
}
type CadastroCliente = {
  nomeCompleto: string
  whatsapp: string
  email: string
  consentimentoMarketing: boolean
  chaveIdempotencia: string
}
type ConfirmacaoVenda = {
  vendaId: string
  tipo: 'VENDA_CANECA' | 'COMPRA_PNEUS'
  formaPagamento: FormaPagamento
  valorTotal: number
}

const FORMAS_PAGAMENTO: Array<{ valor: FormaPagamento; rotulo: string }> = [
  { valor: 'DINHEIRO', rotulo: 'Dinheiro' },
  { valor: 'PIX_EXTERNO', rotulo: 'Pix recebido fora do site' },
  { valor: 'CARTAO_CREDITO_MAQUININHA', rotulo: 'Crédito na maquininha' },
  { valor: 'CARTAO_DEBITO_MAQUININHA', rotulo: 'Débito na maquininha' },
  { valor: 'OUTRO', rotulo: 'Outro' },
]

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function tempoQuiz(duracaoMs: number | null | undefined) {
  if (duracaoMs == null) return 'sem tempo registrado'
  const minutos = Math.floor(duracaoMs / 60_000)
  const segundos = Math.floor((duracaoMs % 60_000) / 1_000)
  const centesimos = Math.floor((duracaoMs % 1_000) / 10)
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}.${String(centesimos).padStart(2, '0')}`
}

export function AtendimentoEventoPirelli({ codigoInicial, visitanteIdInicial = '' }: { codigoInicial: string; visitanteIdInicial?: string }) {
  const [busca, setBusca] = useState(codigoInicial)
  const [visitante, setVisitante] = useState<any>(null)
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const operacaoEmCurso = useRef(false)
  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const [cadastro, setCadastro] = useState<CadastroCliente | null>(null)
  const [confirmacaoVenda, setConfirmacaoVenda] = useState<ConfirmacaoVenda | null>(null)
  const [aviso, setAviso] = useState('')

  const consultarTermo = useCallback(async (termo: string) => {
    if (!termo.trim()) return
    setOcupado(true); setErro(''); setAviso(''); setCandidatos(null)
    const resposta = await fetch(`/api/admin/evento-pirelli/atendimento?codigo=${encodeURIComponent(termo.trim())}`)
    const dados = await resposta.json()
    setOcupado(false)
    if (!resposta.ok) { setVisitante(null); setErro(dados.error); return }
    if (dados.multiplos) { setVisitante(null); setCandidatos(dados.multiplos); return }
    setCaixa(null)
    setVisitante(dados)
  }, [])

  const consultarPorId = useCallback(async (id: string) => {
    setOcupado(true); setErro('')
    const resposta = await fetch(`/api/admin/evento-pirelli/atendimento?id=${encodeURIComponent(id)}`)
    const dados = await resposta.json()
    setOcupado(false)
    if (!resposta.ok) { setErro(dados.error); return }
    setCaixa(null)
    setCandidatos(null)
    setVisitante(dados)
  }, [])

  // Um link interno do painel pode abrir diretamente a ficha pelo id administrativo.
  useEffect(() => {
    input.current?.focus()
    if (visitanteIdInicial) void consultarPorId(visitanteIdInicial)
    else if (codigoInicial) void consultarTermo(codigoInicial)
  }, [codigoInicial, consultarPorId, consultarTermo, visitanteIdInicial])

  async function consultar(e?: FormEvent) {
    e?.preventDefault()
    await consultarTermo(busca)
  }

  async function operar(acao: string, extra: any = {}) {
    if (!visitante || operacaoEmCurso.current) return false
    operacaoEmCurso.current = true
    setOcupado(true)
    setErro('')
    setAviso('')
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

  function abrirCaixa(tipo: Caixa['tipo']) {
    setErro('')
    setAviso('')
    setCaixa({
      tipo,
      quantidade: '1',
      valorPneus: '',
      formaPagamento: 'CARTAO_CREDITO_MAQUININHA',
      referenciaVenda: '',
      chaveIdempotencia: novaChaveIdempotenciaCliente(),
    })
  }

  async function confirmarCaixa(event: FormEvent) {
    event.preventDefault()
    if (!caixa) return
    const extra = caixa.tipo === 'caneca'
      ? {
          quantidade: Number(caixa.quantidade),
          formaPagamento: caixa.formaPagamento,
          referenciaVenda: caixa.referenciaVenda,
          chaveIdempotencia: caixa.chaveIdempotencia,
          tipo: caixa.tipo,
        }
      : {
          valorPneus: Number(caixa.valorPneus.replace(',', '.')),
          formaPagamento: caixa.formaPagamento,
          referenciaVenda: caixa.referenciaVenda,
          chaveIdempotencia: caixa.chaveIdempotencia,
          tipo: caixa.tipo,
        }
    const concluiu = await operar('criar-venda-presencial', extra)
    if (concluiu) {
      setCaixa(null)
      setAviso('Venda criada como aguardando pagamento. Confirme abaixo somente depois da aprovação na maquininha.')
    }
  }

  function abrirCadastro() {
    setErro('')
    setAviso('')
    setCadastro({
      nomeCompleto: '',
      whatsapp: '',
      email: '',
      consentimentoMarketing: false,
      chaveIdempotencia: novaChaveIdempotenciaCliente(),
    })
  }

  async function cadastrarCliente(event: FormEvent) {
    event.preventDefault()
    if (!cadastro || operacaoEmCurso.current) return
    operacaoEmCurso.current = true
    setOcupado(true)
    setErro('')
    setAviso('')
    try {
      const resposta = await fetch('/api/admin/evento-pirelli/atendimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'cadastrar-cliente', ...cadastro }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) { setErro(dados.error); return }
      setVisitante(dados.visitante)
      setBusca(dados.visitante.whatsapp)
      setCandidatos(null)
      setCadastro(null)
      setAviso(dados.reutilizado ? 'Este WhatsApp já estava cadastrado; a ficha existente foi aberta.' : 'Cliente cadastrado. Agora registre a venda presencial.')
    } catch {
      setErro('Falha de rede. Tente novamente; o cadastro não será duplicado.')
    } finally {
      operacaoEmCurso.current = false
      setOcupado(false)
    }
  }

  async function confirmarPagamento(event: FormEvent) {
    event.preventDefault()
    if (!confirmacaoVenda) return
    const concluiu = await operar('confirmar-venda-presencial', {
      vendaId: confirmacaoVenda.vendaId,
    })
    if (concluiu) {
      setConfirmacaoVenda(null)
      setAviso(confirmacaoVenda.tipo === 'VENDA_CANECA'
        ? 'Pagamento confirmado. O link para confirmar o nome da gravação foi enviado no WhatsApp.'
        : 'Pagamento confirmado. Se a compra atingiu a regra da promoção, a caneca foi liberada e o link enviado no WhatsApp.')
    }
  }

  async function cancelarVenda(vendaId: string) {
    const motivo = window.prompt('Motivo do cancelamento desta venda pendente:')?.trim()
    if (!motivo) return
    const concluiu = await operar('cancelar-venda-presencial', { vendaId, motivo })
    if (concluiu) setAviso('Venda pendente cancelada. Nenhum benefício ou lançamento financeiro foi criado.')
  }

  const canecaAguardandoNome = Boolean(visitante && (
    (visitante.elegibilidadesCaneca?.length > 0 && !visitante.canecaBrinde)
    || visitante.comprasCaneca?.some((compra: any) => (
      compra.pagamentoConfirmadoEm
      && compra.status === 'PENDENTE'
      && !compra.nomeGravacaoSnapshot
    ))
  ))

  return <main className="max-w-2xl mx-auto pb-20">
    <header className="mb-5">
      <Link href="/admin/evento-pirelli" className="text-sm text-brand-muted">← Evento Pirelli</Link>
      <h1 className="font-barlow font-black text-4xl text-brand-text mt-2">PDV e atendimento</h1>
      <p className="text-brand-muted">Cadastre ou localize o cliente, registre a venda e confirme o pagamento aprovado na maquininha.</p>
    </header>
    <form onSubmit={consultar} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <input ref={input} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou WhatsApp…" className="min-w-0 rounded-xl p-4 text-lg bg-brand-surface border border-brand-border text-brand-text"/>
      <button aria-label="Buscar cliente" className="rounded-xl bg-brand-accent px-5 py-4 text-white"><Search/></button>
      <button type="button" onClick={abrirCadastro} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-5 py-4 font-bold text-brand-text"><UserPlus size={18}/> Novo cliente</button>
    </form>
    {erro && <p className="mt-3 rounded-lg bg-red-500/10 text-red-300 p-3">{erro}</p>}
    {aviso && <p role="status" className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-300">{aviso}</p>}
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
        <p className="text-brand-muted">Caneca: <strong className="text-brand-text">{visitante.nomeGravacao || 'aguardando definição'}</strong> · {visitante.whatsapp}</p>
        {visitante.nomeGravacaoConfirmadoEm && <p className="mt-1 text-xs text-emerald-300">Nome confirmado em {new Date(visitante.nomeGravacaoConfirmadoEm).toLocaleString('pt-BR')} por {visitante.nomeGravacaoConfirmadoPor || 'origem não registrada'}.</p>}
        <p className="mt-2 text-xs text-brand-muted">{visitante.email || 'E-mail não informado'} · {visitante.motoMarca && visitante.motoModelo ? `${visitante.motoMarca} ${visitante.motoModelo} (${visitante.motoAno ?? 'ano não informado'})` : 'Moto não informada'}</p>
      </div>
      <div className="rounded-2xl bg-brand-surface border border-brand-border p-5">
        <p className="font-bold text-brand-text">Operação no estande</p>
        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border border-brand-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-bold text-brand-text"><PackageCheck size={18} className="text-brand-accent" /> Kit de participação</p>
                <p className="mt-1 text-xs text-brand-muted">Chaveiro + adesivo · {visitante.kitParticipacaoEntregueEm ? `entregue por ${visitante.kitParticipacaoEntreguePor ?? 'Equipe'}` : 'aguardando entrega'}</p>
              </div>
              <button
                disabled={ocupado}
                onClick={() => operar('status-kit-participacao', { entregue: !visitante.kitParticipacaoEntregueEm })}
                className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${visitante.kitParticipacaoEntregueEm ? 'border border-brand-border text-brand-muted' : 'bg-emerald-600 text-white'}`}
              >
                {visitante.kitParticipacaoEntregueEm ? 'Desfazer' : 'Entregar kit'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-brand-border p-4">
            <p className="flex items-center gap-2 font-bold text-brand-text"><Wrench size={18} className="text-brand-accent" /> Balanceamento</p>
            {visitante.balanceamento ? (
              <>
                <p className="mt-1 text-xs text-brand-muted">{visitante.balanceamento.horarioPreferido ?? 'Sem período'} · {visitante.balanceamento.status}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visitante.balanceamento.status === 'INTERESSE' && <button disabled={ocupado} onClick={() => operar('status-balanceamento', { status: 'CONFIRMADO' })} className="rounded-lg bg-[#996f00] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Confirmar vaga</button>}
                  {visitante.balanceamento.status !== 'PARTICIPOU' && <button disabled={ocupado} onClick={() => operar('status-balanceamento', { status: 'PARTICIPOU' })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Marcar participação</button>}
                  {visitante.balanceamento.status !== 'INTERESSE' && <button disabled={ocupado} onClick={() => operar('status-balanceamento', { status: 'INTERESSE' })} className="rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-muted disabled:opacity-50">Reabrir</button>}
                </div>
              </>
            ) : <p className="mt-1 text-xs text-brand-muted">Ainda não se inscreveu na demonstração.</p>}
          </div>

          <div className="rounded-xl border border-brand-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-bold text-brand-text"><Trophy size={18} className="text-brand-accent" /> Quiz</p>
                {visitante.tentativaQuiz ? (
                  <p className="mt-1 text-xs text-brand-muted">
                    {visitante.tentativaQuiz.concluidaEm ? `${visitante.tentativaQuiz.pontuacao}/${visitante.tentativaQuiz.pontuacaoMaxima} acertos` : 'tentativa em andamento'} · <Clock3 size={12} className="inline" /> {tempoQuiz(visitante.tentativaQuiz.duracaoMs)} · {
                      visitante.evento.quizVencedorTentativaId === visitante.tentativaQuiz.id
                        ? 'vencedor confirmado'
                        : visitante.evento.quizEncerradoEm
                          ? 'apuração encerrada — sem prêmio do quiz'
                          : visitante.tentativaQuiz.acertouTodas
                            ? 'classificado provisoriamente'
                            : visitante.tentativaQuiz.concluidaEm ? 'não classificado' : 'aguardando conclusão'
                    }
                  </p>
                ) : <p className="mt-1 text-xs text-brand-muted">Ainda não respondeu ao quiz.</p>}
              </div>
              <Link href="/admin/evento-pirelli/quiz" className="rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-muted">Ranking</Link>
            </div>
          </div>

          {(DESAFIO_FOTO_ATIVO || visitante.participacaoFoto) ? <div className="rounded-xl border border-brand-border p-4">
            <p className="flex items-center gap-2 font-bold text-brand-text"><Camera size={18} className="text-brand-accent" /> Desafio da foto</p>
            {visitante.participacaoFoto ? (
              <p className="mt-1 text-xs text-brand-muted">@{visitante.participacaoFoto.instagram} · {visitante.participacaoFoto.status} · marcações, hashtag e perfil público confirmados</p>
            ) : <p className="mt-1 text-xs text-brand-muted">Participação ainda não registrada.</p>}
          </div> : null}
        </div>
      </div>
      <div className="rounded-2xl bg-brand-surface border border-brand-border p-5">
        <p className="font-bold text-brand-text">Direitos</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {visitante.elegibilidadesCaneca.length ? visitante.elegibilidadesCaneca.map((item: any) => <span key={item.id} className="rounded-full bg-emerald-400/15 text-emerald-300 px-3 py-1 text-sm">{item.origem.replaceAll('_',' ')}{item.valorPneus ? ` · ${moeda(Number(item.valorPneus))}` : ''}{item.formaPagamento ? ` · ${item.formaPagamento.replaceAll('_', ' ')}` : ''}</span>) : <span className="text-brand-muted">Nenhum brinde validado ainda.</span>}
        </div>
        {canecaAguardandoNome && <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
          <p className="text-sm font-bold text-amber-300">Contingência para WhatsApp indisponível</p>
          <p className="mt-1 text-xs text-brand-muted">Confirme verbalmente com o cliente. Seu usuário, data e horário ficarão registrados.</p>
          <button disabled={ocupado} onClick={() => { const nomeGravacao = window.prompt('Nome exato confirmado pelo cliente para gravar na caneca:')?.trim(); if (nomeGravacao) void operar('definir-nome-caneca', { nomeGravacao }) }} className="mt-3 rounded-xl bg-brand-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Confirmar nome manualmente</button>
        </div>}
        {visitante.canecaBrinde && <>
          <p className="mt-4 text-sm text-brand-muted">Caneca brinde: <b className="text-brand-text">{visitante.canecaBrinde.status.replaceAll('_', ' ')}</b></p>
          {visitante.canecaBrinde.status === 'PENDENTE' && <button disabled={ocupado} onClick={() => operar('status-caneca', { status: 'EM_GRAVACAO' })} className="mt-3 w-full rounded-xl bg-[#333] p-4 font-bold text-white disabled:opacity-50">Iniciar gravação</button>}
          {visitante.canecaBrinde.status === 'EM_GRAVACAO' && <button disabled={ocupado} onClick={() => operar('status-caneca', { status: 'PRONTA' })} className="mt-3 w-full rounded-xl bg-[#996f00] p-4 font-bold text-white disabled:opacity-50">Marcar como pronta</button>}
          {visitante.canecaBrinde.status === 'PRONTA' && <button disabled={ocupado} onClick={() => operar('status-caneca', { status: 'ENTREGUE' })} className="mt-3 flex w-full justify-center gap-2 rounded-xl bg-emerald-600 p-4 font-bold text-white disabled:opacity-50"><Check/> Confirmar entrega única</button>}
          {visitante.canecaBrinde.status === 'ENTREGUE' && <p className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-300">Já entregue{visitante.canecaBrinde.entregueEm ? ` em ${new Date(visitante.canecaBrinde.entregueEm).toLocaleString('pt-BR')}` : ''} por {visitante.canecaBrinde.entreguePor ?? 'Equipe'}.</p>}
          {visitante.canecaBrinde.status === 'CANCELADA' && <p className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm font-semibold text-red-300">Caneca cancelada; nenhuma entrega está autorizada.</p>}
        </>}
      </div>
      <div className="rounded-2xl bg-brand-surface border border-brand-border p-5">
        <p className="font-bold text-brand-text">PDV presencial</p>
        <p className="mt-1 text-xs text-brand-muted">Primeiro registre a venda. Depois de conferir a aprovação na maquininha, confirme o pagamento no sistema.</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button disabled={ocupado} onClick={() => abrirCaixa('pneus')} className="rounded-xl border border-brand-border p-4 text-brand-text font-bold disabled:opacity-50">Compra de pneus</button>
          <button disabled={ocupado} onClick={() => abrirCaixa('caneca')} className="rounded-xl border border-brand-border p-4 text-brand-text font-bold flex items-center justify-center gap-2 disabled:opacity-50"><ShoppingBag size={18}/> Venda de caneca</button>
        </div>
        <p className="text-xs text-brand-muted mt-3">Nada entra no caixa, na fila de gravação ou nos brindes enquanto o pagamento estiver pendente.</p>
        {!!visitante.vendasPresenciais?.length && <div className="mt-5 border-t border-brand-border pt-4">
          <p className="text-sm font-bold text-brand-text">Vendas presenciais</p>
          <div className="mt-2 space-y-2">{visitante.vendasPresenciais.map((venda: any) => <div key={venda.id} className={`rounded-xl border p-3 ${venda.status === 'AGUARDANDO_PAGAMENTO' ? 'border-amber-500/30 bg-amber-500/10' : venda.status === 'PAGO' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-brand-border bg-black/15'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-brand-text">{venda.tipo === 'VENDA_CANECA' ? `${venda.quantidade}x caneca` : 'Compra de pneus'} · {moeda(Number(venda.valorTotal))}</p>
                <p className="mt-1 text-xs text-brand-muted">{venda.formaPagamento.replaceAll('_', ' ')} · {venda.status === 'AGUARDANDO_PAGAMENTO' ? 'aguardando confirmação' : venda.status === 'PAGO' ? `pago por ${venda.pagamentoConfirmadoPor ?? 'Equipe'}` : `cancelado por ${venda.canceladoPor ?? 'Equipe'}`}</p>
                {venda.referenciaVenda && <p className="mt-1 text-xs text-brand-muted">Pedido/comprovante: {venda.referenciaVenda}</p>}
                {venda.cancelamentoMotivo && <p className="mt-1 text-xs text-red-300">Motivo: {venda.cancelamentoMotivo}</p>}
              </div>
              {venda.status === 'AGUARDANDO_PAGAMENTO' && <div className="flex gap-2">
                <button disabled={ocupado} onClick={() => setConfirmacaoVenda({ vendaId: venda.id, tipo: venda.tipo, formaPagamento: venda.formaPagamento, valorTotal: Number(venda.valorTotal) })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Confirmar pagamento</button>
                <button disabled={ocupado} onClick={() => cancelarVenda(venda.id)} className="rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-brand-muted disabled:opacity-50">Cancelar</button>
              </div>}
            </div>
          </div>)}</div>
        </div>}
        {!!visitante.comprasCaneca?.length && <div className="mt-4 space-y-2">
          {visitante.comprasCaneca.map((compra: any) => <div key={compra.id} className="rounded-xl bg-brand-bg/40 p-3 flex items-center justify-between gap-3">
            <div><p className="text-brand-text font-bold">{compra.quantidade}x {compra.nomeGravacaoSnapshot || 'aguardando nome'}</p><p className="text-xs text-brand-muted">{compra.status.replaceAll('_',' ')}{compra.formaPagamento ? ` · ${compra.formaPagamento.replaceAll('_', ' ')}` : ''}{compra.valorPago ? ` · ${moeda(Number(compra.valorPago))}` : ''}{compra.referenciaVenda ? ` · ${compra.referenciaVenda}` : ''}</p></div>
            {compra.nomeGravacaoSnapshot && compra.status !== 'ENTREGUE' && compra.status !== 'CANCELADA' && <button disabled={ocupado} onClick={() => operar('status-compra-caneca', { compraId: compra.id, status: compra.status === 'PENDENTE' ? 'EM_GRAVACAO' : compra.status === 'EM_GRAVACAO' ? 'PRONTA' : 'ENTREGUE' })} className="rounded-lg bg-[#333] text-white text-sm px-3 py-2 disabled:opacity-50">Avançar</button>}
          </div>)}
        </div>}
        {!!visitante.lancamentosCaixa?.length && <div className="mt-5 border-t border-brand-border pt-4">
          <p className="text-sm font-bold text-brand-text">Histórico financeiro desta pessoa</p>
          <div className="mt-2 space-y-2">{visitante.lancamentosCaixa.map((item: any) => <div key={item.id} className="rounded-xl bg-black/15 p-3 text-xs text-brand-muted">
            <p><b className="text-brand-text">{item.tipo === 'VENDA_CANECA' ? 'Caneca' : 'Pneus'} · {moeda(Number(item.valorTotal))}</b> · {item.formaPagamento.replaceAll('_', ' ')}</p>
            <p className="mt-1">{new Date(item.confirmadoEm).toLocaleString('pt-BR')} · {item.confirmadoPor}{item.referenciaPagamento ? ` · Ref. ${item.referenciaPagamento}` : ''}</p>
            {item.estornadoEm && <p className="mt-1 font-bold text-red-300">Estornado em {new Date(item.estornadoEm).toLocaleString('pt-BR')}</p>}
          </div>)}</div>
        </div>}
      </div>
    </section>}

    {caixa && visitante && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <form onSubmit={confirmarCaixa} className="mx-auto my-3 max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Novo pedido no PDV</p>
            <h2 className="mt-1 font-barlow text-3xl font-black text-brand-text">{caixa.tipo === 'caneca' ? 'Venda de caneca' : 'Compra de pneus'}</h2>
            <p className="text-sm text-brand-muted">{visitante.nomeCompleto}</p>
          </div>
          <button type="button" onClick={() => setCaixa(null)} aria-label="Fechar" className="rounded-xl border border-brand-border p-2 text-brand-muted"><X /></button>
        </div>

        <div className="mt-5 grid gap-4">
          {caixa.tipo === 'caneca' ? <label className="text-sm font-medium text-brand-muted">Quantidade
            <input required type="number" min="1" max="10" value={caixa.quantidade} onChange={(e) => setCaixa({ ...caixa, quantidade: e.target.value })} className="mt-1 w-full rounded-xl border border-brand-border bg-black/20 p-4 text-lg text-brand-text" />
          </label> : <label className="text-sm font-medium text-brand-muted">Subtotal somente dos pneus
            <input required inputMode="decimal" value={caixa.valorPneus} onChange={(e) => setCaixa({ ...caixa, valorPneus: e.target.value })} placeholder="Ex.: 1250,00" className="mt-1 w-full rounded-xl border border-brand-border bg-black/20 p-4 text-lg text-brand-text" />
          </label>}

          <label className="text-sm font-medium text-brand-muted">Forma de pagamento
            <select value={caixa.formaPagamento} onChange={(e) => setCaixa({ ...caixa, formaPagamento: e.target.value as FormaPagamento })} className="mt-1 w-full rounded-xl border border-brand-border bg-black/20 p-4 text-brand-text">
              {FORMAS_PAGAMENTO.map((forma) => <option key={forma.valor} value={forma.valor}>{forma.rotulo}</option>)}
            </select>
          </label>

          <label className="text-sm font-medium text-brand-muted">Número do pedido/comprovante (opcional)
            <input value={caixa.referenciaVenda} onChange={(e) => setCaixa({ ...caixa, referenciaVenda: e.target.value })} className="mt-1 w-full rounded-xl border border-brand-border bg-black/20 p-4 text-brand-text" />
          </label>

          <div className="rounded-2xl border border-brand-border bg-black/15 p-4">
            <p className="flex items-center gap-2 font-bold text-brand-text"><CreditCard size={18} className="text-brand-accent" /> Resumo para conferência</p>
            <p className="mt-2 text-sm text-brand-muted">{caixa.tipo === 'caneca' ? `${caixa.quantidade || 0} caneca(s) · ${moeda(Number(visitante.evento.valorCanecaAvulsa) * Number(caixa.quantidade || 0))}` : `Pneus · ${moeda(Number(caixa.valorPneus.replace(',', '.')) || 0)}`}</p>
          </div>

          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-brand-text">
            <b className="block text-amber-300">Esta etapa ainda não confirma o pagamento</b>
            <span className="text-xs text-brand-muted">O pedido ficará pendente. Após conferir a aprovação na maquininha, use “Confirmar pagamento”.</span>
          </div>
        </div>

        <button disabled={ocupado} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-accent px-5 font-bold text-white disabled:opacity-45"><ShoppingBag size={19} /> {ocupado ? 'Criando pedido…' : 'Criar venda pendente'}</button>
      </form>
    </div>}

    {cadastro && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <form onSubmit={cadastrarCliente} className="mx-auto my-3 max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Cadastro pelo atendente</p>
            <h2 className="mt-1 font-barlow text-3xl font-black text-brand-text">Novo cliente</h2>
            <p className="text-sm text-brand-muted">Dados mínimos para identificar a venda e enviar a confirmação no WhatsApp.</p>
          </div>
          <button type="button" onClick={() => setCadastro(null)} aria-label="Fechar" className="rounded-xl border border-brand-border p-2 text-brand-muted"><X /></button>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="text-sm font-medium text-brand-muted">Nome completo
            <input required minLength={2} maxLength={120} value={cadastro.nomeCompleto} onChange={(e) => setCadastro({ ...cadastro, nomeCompleto: e.target.value })} autoComplete="name" className="mt-1 w-full rounded-xl border border-brand-border bg-black/20 p-4 text-brand-text" />
          </label>
          <label className="text-sm font-medium text-brand-muted">WhatsApp com DDD
            <input required inputMode="tel" value={cadastro.whatsapp} onChange={(e) => setCadastro({ ...cadastro, whatsapp: e.target.value })} placeholder="(19) 99999-9999" autoComplete="tel" className="mt-1 w-full rounded-xl border border-brand-border bg-black/20 p-4 text-brand-text" />
          </label>
          <label className="text-sm font-medium text-brand-muted">E-mail (opcional)
            <input type="email" maxLength={254} value={cadastro.email} onChange={(e) => setCadastro({ ...cadastro, email: e.target.value })} autoComplete="email" className="mt-1 w-full rounded-xl border border-brand-border bg-black/20 p-4 text-brand-text" />
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-brand-border bg-black/15 p-4 text-sm text-brand-text">
            <input type="checkbox" checked={cadastro.consentimentoMarketing} onChange={(e) => setCadastro({ ...cadastro, consentimentoMarketing: e.target.checked })} className="mt-0.5 h-5 w-5 accent-brand-accent" />
            <span><b className="block">Cliente autorizou comunicações promocionais</b><span className="text-xs text-brand-muted">A confirmação desta compra pelo WhatsApp é transacional e não depende desta opção.</span></span>
          </label>
        </div>
        <button disabled={ocupado} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-accent px-5 font-bold text-white disabled:opacity-45"><UserPlus size={19}/> {ocupado ? 'Cadastrando…' : 'Cadastrar e abrir ficha'}</button>
      </form>
    </div>}

    {confirmacaoVenda && visitante && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <form onSubmit={confirmarPagamento} className="mx-auto my-3 max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Aprovação da maquininha</p>
            <h2 className="mt-1 font-barlow text-3xl font-black text-brand-text">Confirmar pagamento</h2>
            <p className="text-sm text-brand-muted">{visitante.nomeCompleto} · {moeda(confirmacaoVenda.valorTotal)}</p>
          </div>
          <button type="button" onClick={() => setConfirmacaoVenda(null)} aria-label="Fechar" className="rounded-xl border border-brand-border p-2 text-brand-muted"><X /></button>
        </div>
        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border border-brand-border bg-black/15 p-4 text-sm text-brand-muted">
            <p><b className="text-brand-text">Pagamento:</b> {confirmacaoVenda.formaPagamento.replaceAll('_', ' ')}</p>
            <p className="mt-1">Confirme somente depois de visualizar a aprovação na maquininha ou o recebimento do valor.</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-brand-text">
            <b className="block text-emerald-300">O que acontece ao confirmar</b>
            <span className="text-xs text-brand-muted">O caixa é lançado, a caneca ou o benefício é liberado quando aplicável e o cliente recebe no WhatsApp o link para confirmar o nome da gravação.</span>
          </div>
        </div>
        <button disabled={ocupado} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 font-bold text-white disabled:opacity-45"><Check size={19}/> {ocupado ? 'Confirmando…' : 'Pagamento aprovado — confirmar'}</button>
      </form>
    </div>}
  </main>
}
