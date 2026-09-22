'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AtSign, CheckCircle2, Crown, RefreshCw, XCircle } from 'lucide-react'

type Foto = {
  id: string
  instagram: string
  declarouMarcacoes: boolean
  declarouHashtag: boolean
  declarouPerfilPublico: boolean
  status: 'PENDENTE' | 'FINALISTA' | 'VENCEDOR' | 'DESCARTADO'
  curtidasApuradas: number | null
  observacao: string | null
  visitante: {
    nomeCompleto: string
    whatsapp: string
  }
}

export function FotosEventoPirelli() {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    setErro('')
    const resposta = await fetch('/api/admin/evento-pirelli/fotos')
    const dados = await resposta.json()
    setCarregando(false)
    if (resposta.ok) setFotos(dados)
    else setErro(dados.error)
  }

  useEffect(() => { void carregar() }, [])

  const ranking = useMemo(
    () => [...fotos].sort((a, b) => (b.curtidasApuradas ?? -1) - (a.curtidasApuradas ?? -1)),
    [fotos],
  )

  async function apurar(foto: Foto, status: Foto['status']) {
    const curtidasInformadas = window.prompt('Curtidas apuradas no Instagram:', String(foto.curtidasApuradas ?? ''))
    if (curtidasInformadas === null) return
    const curtidas = curtidasInformadas.trim() === '' ? null : Number(curtidasInformadas)
    if (status === 'VENCEDOR' && curtidas === null) {
      setErro('Informe as curtidas antes de confirmar a foto vencedora.')
      return
    }
    const observacao = window.prompt('Observação da apuração (opcional):', foto.observacao ?? '')
    if (observacao === null) return

    setProcessando(foto.id)
    setErro('')
    const resposta = await fetch('/api/admin/evento-pirelli/fotos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: foto.id, status, curtidasApuradas: curtidas, observacao }),
    })
    const dados = await resposta.json()
    setProcessando(null)
    if (!resposta.ok) {
      setErro(dados.error)
      return
    }
    await carregar()
  }

  return (
    <main className="mx-auto max-w-4xl pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/evento-pirelli" className="text-sm text-brand-muted">← Evento Pirelli</Link>
          <h1 className="mt-2 font-barlow text-4xl font-black text-brand-text">Concurso de foto</h1>
          <p className="mt-1 text-brand-muted">Ranking manual por curtidas. O sistema mantém apenas uma foto vencedora.</p>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={carregando} className="inline-flex items-center gap-2 rounded-xl border border-brand-border px-4 py-3 text-sm font-bold text-brand-text disabled:opacity-50">
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">
        <strong className="text-brand-text">Regra oficial:</strong> publicação no feed ou Reels com @forzamotos, @pirelli, @campneus e #DesafioForzaNoRodeo. O perfil deve permanecer público até a apuração.
      </div>

      {erro && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{erro}</p>}
      {carregando && <p className="mt-5 text-brand-muted">Atualizando ranking…</p>}

      <div className="mt-5 grid gap-3">
        {ranking.map((foto, indice) => {
          const valida = foto.declarouMarcacoes && foto.declarouHashtag && foto.declarouPerfilPublico
          return (
            <article key={foto.id} className={`rounded-2xl border p-5 ${foto.status === 'VENCEDOR' ? 'border-amber-400/60 bg-amber-400/10' : 'border-brand-border bg-brand-surface'}`}>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-brand-muted">#{indice + 1} no ranking</p>
                  <p className="mt-1 font-barlow text-2xl font-black text-brand-text">{foto.visitante.nomeCompleto}</p>
                  <p className="inline-flex items-center gap-1 text-sm text-brand-muted"><AtSign size={14} /> @{foto.instagram} · {foto.visitante.whatsapp}</p>
                </div>
                <div className="text-right">
                  <p className="font-barlow text-3xl font-black text-brand-text">{foto.curtidasApuradas ?? '—'}</p>
                  <p className="text-xs uppercase tracking-wider text-brand-muted">curtidas</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Selo valido={foto.declarouMarcacoes}>3 marcações</Selo>
                <Selo valido={foto.declarouHashtag}>Hashtag</Selo>
                <Selo valido={foto.declarouPerfilPublico}>Perfil público</Selo>
                <span className="rounded-full border border-brand-border px-3 py-1 text-brand-muted">{foto.status}</span>
              </div>

              {!valida && <p className="mt-3 text-xs text-red-300">Participação incompleta: não pode ser confirmada como vencedora.</p>}
              {foto.observacao && <p className="mt-3 text-sm text-brand-muted">{foto.observacao}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={processando === foto.id} onClick={() => void apurar(foto, 'FINALISTA')} className="rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text disabled:opacity-50">Salvar como finalista</button>
                <button type="button" disabled={!valida || processando === foto.id} onClick={() => void apurar(foto, 'VENCEDOR')} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-40"><Crown size={15} /> Confirmar mais curtida</button>
                <button type="button" disabled={processando === foto.id} onClick={() => void apurar(foto, 'DESCARTADO')} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 disabled:opacity-50"><XCircle size={15} /> Invalidar</button>
              </div>
            </article>
          )
        })}
        {!carregando && !ranking.length && <p className="p-6 text-brand-muted">Ainda não há participações.</p>}
      </div>
    </main>
  )
}

function Selo({ valido, children }: { valido: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${valido ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/10 text-red-300'}`}>
      <CheckCircle2 size={13} /> {children}
    </span>
  )
}
