'use client'

import Link from 'next/link'
import { ChangeEvent, useState } from 'react'
import { Camera, Download, ExternalLink, FileQuestion, FileText, Gift, Package, QrCode, Save, Users, WalletCards } from 'lucide-react'
import { DESAFIO_FOTO_ATIVO } from '@/lib/evento-pirelli/config'

const ROTULOS_CAIXA: Record<string, string> = {
  PIX_MERCADO_PAGO: 'Pix Mercado Pago', MERCADO_PAGO: 'Mercado Pago', PIX_EXTERNO: 'Pix externo',
  DINHEIRO: 'Dinheiro', CARTAO_CREDITO_MAQUININHA: 'Crédito maquininha',
  CARTAO_DEBITO_MAQUININHA: 'Débito maquininha', OUTRO: 'Outro',
}
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function AdminEventoPirelli({ evento: inicial, qrs, resumoCaixa }: { evento: any; qrs: { titulo: string; descricao: string; url: string; svg: string }[]; resumoCaixa: { total: number; lancamentos: number; porForma: Array<{ forma: string; total: number; lancamentos: number }> } }) {
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
        valorCanecaAvulsa: Number(dados.valorCanecaAvulsa),
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

      <nav className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          ['/admin/evento-pirelli/atendimento', 'PDV e atendimento', WalletCards],
          ['/admin/evento-pirelli/leads', 'CRM do evento', Users],
          ['/admin/evento-pirelli/produtos', 'Produtos e vendas', Package],
          ['/admin/evento-pirelli/canecas', 'Canecas / impressão', Gift],
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

      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-barlow text-2xl font-black text-brand-text">Fechamento financeiro do evento</h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-muted">Exporta todas as vendas de caneca e compras de pneus registradas no caixa, com forma de pagamento, valor, referência, operador e horário.</p>
          </div>
          <a href="/api/admin/evento-pirelli/export?tipo=caixa" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white"><Download size={17} /> Baixar fechamento do caixa</a>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-black/15 p-4">
            <p className="font-barlow text-3xl font-black text-brand-text">{moeda(resumoCaixa.total)}</p>
            <p className="text-xs text-brand-muted">Total recebido · {resumoCaixa.lancamentos} lançamentos</p>
          </div>
          {resumoCaixa.porForma.map((item) => <div key={item.forma} className="rounded-2xl border border-brand-border bg-black/10 p-4">
            <p className="font-barlow text-2xl font-black text-brand-text">{moeda(item.total)}</p>
            <p className="text-xs text-brand-muted">{ROTULOS_CAIXA[item.forma] ?? item.forma} · {item.lancamentos}</p>
          </div>)}
        </div>
      </section>

      {/* QR Codes para Imprimir */}
      <section className="rounded-2xl bg-brand-surface border border-brand-border p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-barlow text-2xl font-black text-brand-text">Banner principal — um único QR Code</h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-muted">Este é o arquivo recomendado para o evento. O QR abre a landing principal e o visitante escolhe caneca, produtos, quiz ou balanceamento.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/downloads/banner-principal-evento-pirelli-A2-300dpi.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-sm font-bold text-white transition-colors hover:brightness-110"
            >
              <FileText size={17} /> Abrir banner principal A2
            </a>
            <a
              href="/downloads/banners-evento-pirelli-A2-300dpi.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-border px-4 py-3 text-sm font-bold text-brand-text transition-colors hover:border-brand-accent"
            >
              <ExternalLink size={16} /> QRs específicos opcionais
            </a>
          </div>
        </div>
        <div className="mb-6 rounded-2xl border border-brand-accent/30 bg-brand-accent/10 p-4 text-sm text-brand-text">
          <b>Destino do QR principal:</b> forzamotos.com.br/evento-pirelli. O cadastro só aparece quando a ação escolhida precisar identificar o participante.
        </div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-brand-muted">Atalhos diretos opcionais</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
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

              <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#777]"><QrCode size={15} /> QR específico opcional</p>
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
            Caneca avulsa (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={evento.valorCanecaAvulsa}
              onChange={(e) => setEvento({ ...evento, valorCanecaAvulsa: Number(e.target.value) })}
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

        <div className="mt-5 rounded-2xl border border-brand-border bg-black/10 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-brand-text">Onde divulgar o evento</h3>
            <p className="mt-1 text-xs text-brand-muted">A vitrine só será exibida enquanto o evento também estiver ativo e publicado.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-text">
              <input
                type="checkbox"
                checked={Boolean(evento.exibirNaHome)}
                onChange={(e) => setEvento({ ...evento, exibirNaHome: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-brand-accent"
              />
              <span><b className="block">Exibir na home</b><span className="text-xs text-brand-muted">Inclui o Pirelli em “Próximos Eventos”.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-text">
              <input
                type="checkbox"
                checked={Boolean(evento.exibirEmEventos)}
                onChange={(e) => setEvento({ ...evento, exibirEmEventos: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-brand-accent"
              />
              <span><b className="block">Exibir na página de eventos</b><span className="text-xs text-brand-muted">Inclui o Pirelli no calendário público.</span></span>
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-brand-border bg-black/10 p-4 md:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-text">
            <input
              type="checkbox"
              checked={Boolean(evento.inscricoesAntecipadasAbertas)}
              onChange={(e) => setEvento({ ...evento, inscricoesAntecipadasAbertas: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-brand-accent"
            />
            <span><b className="block">Experiências abertas agora</b><span className="text-xs text-brand-muted">Libera cadastro, quiz e balanceamento. A data final continua encerrando toda a experiência.{DESAFIO_FOTO_ATIVO ? ' O desafio da foto também está ativo.' : ''}</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-text">
            <input
              type="checkbox"
              checked={Boolean(evento.vendasAntecipadasAbertas)}
              onChange={(e) => setEvento({ ...evento, vendasAntecipadasAbertas: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-brand-accent"
            />
            <span><b className="block">Vendas abertas agora</b><span className="text-xs text-brand-muted">Libera ofertas e checkout próprio da caneca.</span></span>
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
          {['leads', 'quiz', 'canecas', 'fotos', 'compras', 'operacao'].map((tipo) => (
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
