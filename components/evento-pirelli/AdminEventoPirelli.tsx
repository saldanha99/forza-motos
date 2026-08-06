'use client'

import Link from 'next/link'
import { ChangeEvent, useState } from 'react'
import { Camera, Download, ExternalLink, FileQuestion, Gift, QrCode, Save, Users } from 'lucide-react'

export function AdminEventoPirelli({ evento: inicial, qrs }: { evento: any; qrs: { titulo: string; descricao: string; url: string; svg: string }[] }) {
  const [evento, setEvento] = useState(inicial)
  const [mensagem, setMensagem] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    const resposta = await fetch('/api/admin/evento-pirelli', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evento),
    })
    const dados = await resposta.json()
    setSalvando(false)
    if (resposta.ok) {
      setEvento({
        ...dados,
        dataInicio: dados.dataInicio ? new Date(dados.dataInicio).toISOString().slice(0, 16) : null,
        dataFim: dados.dataFim ? new Date(dados.dataFim).toISOString().slice(0, 16) : null,
        valorMinimoPneus: Number(dados.valorMinimoPneus),
      })
      setMensagem('Configuração salva com sucesso.')
    } else {
      setMensagem(dados.error)
    }
  }

  async function upload(campo: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setMensagem('Enviando imagem…')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('pasta', 'evento-pirelli')
    const resposta = await fetch('/api/upload', { method: 'POST', body: fd })
    const dados = await resposta.json()
    if (resposta.ok) {
      setEvento({ ...evento, [campo]: dados.url })
      setMensagem('Imagem enviada. Clique em salvar para publicar.')
    } else {
      setMensagem(dados.error)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 font-inter">
      <header className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <p className="text-brand-accent text-xs font-bold uppercase tracking-widest">Operação de stand</p>
          <h1 className="font-barlow font-black text-4xl text-brand-text">Evento Pirelli</h1>
          <p className="text-brand-muted mt-1">Ferramentas diretas, pensadas para atendimento em fila.</p>
        </div>
        <a
          href="/evento-pirelli"
          target="_blank"
          className="inline-flex h-fit gap-2 items-center rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-brand-text hover:border-brand-accent transition-colors font-medium text-sm"
        >
          <ExternalLink size={16} /> Abrir landing page
        </a>
      </header>

      <nav className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ['/admin/evento-pirelli/atendimento', 'Atendimento', Users],
          ['/admin/evento-pirelli/leads', 'Leads', Users],
          ['/admin/evento-pirelli/canecas', 'Canecas', Gift],
          ['/admin/evento-pirelli/fotos', 'Fotos', Camera],
          ['/admin/evento-pirelli/quiz', 'Quiz', FileQuestion],
        ].map(([href, label, Icon]: any) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl p-5 bg-brand-surface border border-brand-border text-brand-text hover:border-brand-accent flex gap-3 items-center transition-colors"
          >
            <Icon className="text-brand-accent shrink-0" />
            <b className="text-sm font-semibold">{label}</b>
          </Link>
        ))}
      </nav>

      {/* QR Codes para Imprimir */}
      <section className="rounded-2xl bg-brand-surface border border-brand-border p-6 shadow-sm">
        <h2 className="font-barlow text-2xl font-black text-brand-text mb-5">QR codes para imprimir</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {qrs.map((qr) => (
            <div
              key={qr.titulo}
              className="bg-white text-[#111] rounded-2xl p-6 flex flex-col items-center justify-between text-center border border-gray-200 shadow-sm"
            >
              {/* Título & Descrição (acima do QR Code para nunca ter sobreposição) */}
              <div className="w-full mb-3">
                <h3 className="font-barlow font-bold text-xl text-[#111] leading-snug">{qr.titulo}</h3>
                <p className="text-xs text-[#666] mt-1 line-clamp-2">{qr.descricao}</p>
              </div>

              {/* QR Code SVG responsivo sem transbordo */}
              <div className="w-44 h-44 my-2 flex items-center justify-center p-2 bg-white rounded-xl border border-gray-100 shadow-inner overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain">
                <div dangerouslySetInnerHTML={{ __html: qr.svg }} className="w-full h-full" />
              </div>

              {/* Botão de Impressão */}
              <button
                onClick={() => window.print()}
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-[#d42b2b] font-bold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors"
              >
                <QrCode size={16} /> Imprimir esta página
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Configurações da Landing Page */}
      <section className="rounded-2xl bg-brand-surface border border-brand-border p-6">
        <h2 className="font-barlow text-2xl font-black text-brand-text mb-4">Configuração da landing e promoção</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            ['titulo', 'Título'],
            ['local', 'Local'],
            ['descricao', 'Copy de apresentação'],
            ['logoForzaUrl', 'Logo Forza (URL)'],
            ['logoPirelliUrl', 'Logo Pirelli (URL)'],
            ['logoCampneusUrl', 'Logo Campneus (URL)'],
          ].map(([campo, label]) => (
            <label className="text-sm font-medium text-brand-muted" key={campo}>
              {label}
              <input
                value={evento[campo] ?? ''}
                onChange={(e) => setEvento({ ...evento, [campo]: e.target.value })}
                className="mt-1 block w-full rounded-xl bg-black/20 border border-brand-border p-3 text-brand-text text-sm outline-none focus:border-brand-accent transition-colors"
              />
            </label>
          ))}

          <label className="text-sm font-medium text-brand-muted">
            Início
            <input
              type="datetime-local"
              value={evento.dataInicio ? evento.dataInicio.slice(0, 16) : ''}
              onChange={(e) => setEvento({ ...evento, dataInicio: e.target.value })}
              className="mt-1 block w-full rounded-xl bg-black/20 border border-brand-border p-3 text-brand-text text-sm outline-none focus:border-brand-accent transition-colors"
            />
          </label>

          <label className="text-sm font-medium text-brand-muted">
            Fim
            <input
              type="datetime-local"
              value={evento.dataFim ? evento.dataFim.slice(0, 16) : ''}
              onChange={(e) => setEvento({ ...evento, dataFim: e.target.value })}
              className="mt-1 block w-full rounded-xl bg-black/20 border border-brand-border p-3 text-brand-text text-sm outline-none focus:border-brand-accent transition-colors"
            />
          </label>

          <label className="text-sm font-medium text-brand-muted">
            Limite do nome de gravação
            <input
              type="number"
              min="2"
              max="50"
              value={evento.limiteNomeGravacao}
              onChange={(e) => setEvento({ ...evento, limiteNomeGravacao: Number(e.target.value) })}
              className="mt-1 block w-full rounded-xl bg-black/20 border border-brand-border p-3 text-brand-text text-sm outline-none focus:border-brand-accent transition-colors"
            />
          </label>

          <label className="text-sm font-medium text-brand-muted">
            Subtotal de pneus (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={evento.valorMinimoPneus}
              onChange={(e) => setEvento({ ...evento, valorMinimoPneus: Number(e.target.value) })}
              className="mt-1 block w-full rounded-xl bg-black/20 border border-brand-border p-3 text-brand-text text-sm outline-none focus:border-brand-accent transition-colors"
            />
          </label>

          <label className="text-sm font-medium text-brand-muted">
            Operador
            <select
              value={evento.operadorValorMinimoPneus}
              onChange={(e) => setEvento({ ...evento, operadorValorMinimoPneus: e.target.value })}
              className="mt-1 block w-full rounded-xl bg-black/20 border border-brand-border p-3 text-brand-text text-sm outline-none focus:border-brand-accent transition-colors"
            >
              <option value="MAIOR_QUE">Maior que (&gt;)</option>
              <option value="MAIOR_OU_IGUAL">Maior ou igual (≥)</option>
            </select>
          </label>

          {['logoForzaUrl', 'logoPirelliUrl', 'logoCampneusUrl'].map((campo) => (
            <label key={campo} className="text-sm font-medium text-brand-muted">
              Enviar {campo.replace('Url', '')}
              <input type="file" accept="image/*" onChange={(e) => upload(campo, e)} className="mt-1 block w-full text-xs" />
            </label>
          ))}
        </div>

        <div className="flex gap-6 mt-6">
          <label className="text-sm text-brand-text flex gap-2 items-center cursor-pointer">
            <input
              type="checkbox"
              checked={evento.ativo}
              onChange={(e) => setEvento({ ...evento, ativo: e.target.checked })}
              className="accent-brand-accent w-4 h-4"
            />{' '}
            Ativo
          </label>
          <label className="text-sm text-brand-text flex gap-2 items-center cursor-pointer">
            <input
              type="checkbox"
              checked={evento.publicado}
              onChange={(e) => setEvento({ ...evento, publicado: e.target.checked })}
              className="accent-brand-accent w-4 h-4"
            />{' '}
            Publicado
          </label>
        </div>

        {mensagem && <p className="mt-4 text-sm text-brand-accent font-semibold">{mensagem}</p>}

        <button
          onClick={salvar}
          disabled={salvando}
          className="mt-6 inline-flex gap-2 rounded-xl bg-brand-accent hover:bg-red-700 disabled:opacity-50 px-6 py-3.5 text-white font-bold text-sm shadow-md transition-colors"
        >
          <Save size={16} />
          {salvando ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </section>

      {/* Exportações */}
      <section className="rounded-2xl bg-brand-surface border border-brand-border p-6">
        <h2 className="font-barlow text-2xl font-black text-brand-text">Exportações</h2>
        <div className="flex flex-wrap gap-3 mt-4">
          {['leads', 'quiz', 'canecas', 'fotos', 'compras'].map((tipo) => (
            <a
              key={tipo}
              href={`/api/admin/evento-pirelli/export?tipo=${tipo}`}
              className="inline-flex gap-2 border border-brand-border bg-brand-surface-2 hover:bg-brand-elevated text-brand-text rounded-xl px-4 py-3 font-semibold text-xs uppercase tracking-wider transition-colors"
            >
              <Download size={16} /> CSV {tipo}
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
