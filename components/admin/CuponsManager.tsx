'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Ticket, Plus, Trash2, Power } from 'lucide-react'

interface Cupom {
  id: string
  codigo: string
  tipo: 'PERCENTUAL' | 'VALOR'
  valor: number
  minSubtotal: number | null
  validadeAte: string | null
  usoMaximo: number | null
  usados: number
  ativo: boolean
  descricao: string | null
}

const FORM_VAZIO = {
  codigo: '', tipo: 'PERCENTUAL' as 'PERCENTUAL' | 'VALOR', valor: '',
  minSubtotal: '', validadeAte: '', usoMaximo: '', descricao: '',
}

export function CuponsManager({ cuponsIniciais }: { cuponsIniciais: Cupom[] }) {
  const [cupons, setCupons] = useState(cuponsIniciais)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  function up(campo: string, v: string) {
    setForm((f) => ({ ...f, [campo]: v }))
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const res = await fetch('/api/admin/cupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar cupom')
      setCupons((c) => [{ ...data, valor: Number(data.valor), minSubtotal: data.minSubtotal ? Number(data.minSubtotal) : null }, ...c])
      setForm(FORM_VAZIO)
      toast.success('Cupom criado!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function toggle(cupom: Cupom) {
    const res = await fetch(`/api/admin/cupons/${cupom.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !cupom.ativo }),
    })
    if (res.ok) {
      setCupons((c) => c.map((x) => (x.id === cupom.id ? { ...x, ativo: !x.ativo } : x)))
    } else {
      toast.error('Erro ao alterar cupom')
    }
  }

  async function remover(cupom: Cupom) {
    if (!confirm(`Excluir o cupom ${cupom.codigo}?`)) return
    const res = await fetch(`/api/admin/cupons/${cupom.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCupons((c) => c.filter((x) => x.id !== cupom.id))
      toast.success('Cupom excluído')
    } else {
      toast.error('Erro ao excluir')
    }
  }

  const fmt = (n: number) => `R$ ${n.toFixed(2)}`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      {/* Formulário */}
      <form onSubmit={criar} className="bg-brand-card border border-brand-line rounded-xl p-5 space-y-4 h-fit">
        <h2 className="font-barlow font-bold text-lg text-brand-text flex items-center gap-2">
          <Plus size={18} /> Novo cupom
        </h2>

        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Código *</label>
          <input value={form.codigo} onChange={(e) => up('codigo', e.target.value.toUpperCase())}
            placeholder="SOROCABA10" required
            className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text uppercase outline-none focus:border-[#d42b2b]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Tipo *</label>
            <select value={form.tipo} onChange={(e) => up('tipo', e.target.value)}
              className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]">
              <option value="PERCENTUAL">Percentual (%)</option>
              <option value="VALOR">Valor (R$)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">
              {form.tipo === 'PERCENTUAL' ? 'Desconto (%)' : 'Desconto (R$)'} *
            </label>
            <input type="number" step="0.01" min="0" value={form.valor} onChange={(e) => up('valor', e.target.value)} required
              className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Mín. compra (R$)</label>
            <input type="number" step="0.01" min="0" value={form.minSubtotal} onChange={(e) => up('minSubtotal', e.target.value)}
              placeholder="opcional"
              className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Máx. usos</label>
            <input type="number" min="1" value={form.usoMaximo} onChange={(e) => up('usoMaximo', e.target.value)}
              placeholder="ilimitado"
              className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Validade</label>
          <input type="date" value={form.validadeAte} onChange={(e) => up('validadeAte', e.target.value)}
            className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Descrição interna</label>
          <input value={form.descricao} onChange={(e) => up('descricao', e.target.value)}
            placeholder="Ex.: Evento custom Sorocaba"
            className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
        </div>

        <button type="submit" disabled={salvando}
          className="w-full bg-[#d42b2b] hover:bg-red-700 disabled:opacity-60 text-white font-barlow font-bold uppercase text-sm tracking-wider py-2.5 rounded-lg transition-colors">
          {salvando ? 'Criando…' : 'Criar cupom'}
        </button>
      </form>

      {/* Lista */}
      <div className="space-y-3">
        {cupons.length === 0 && (
          <div className="bg-brand-card border border-brand-line rounded-xl p-8 text-center text-brand-muted text-sm">
            <Ticket size={28} className="mx-auto mb-2 opacity-50" />
            Nenhum cupom criado ainda.
          </div>
        )}
        {cupons.map((c) => {
          const expirado = c.validadeAte && new Date(c.validadeAte) < new Date()
          const esgotado = c.usoMaximo != null && c.usados >= c.usoMaximo
          return (
            <div key={c.id} className="bg-brand-card border border-brand-line rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-barlow font-black text-lg text-brand-text tracking-wide">{c.codigo}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#d42b2b]/10 text-[#d42b2b]">
                    {c.tipo === 'PERCENTUAL' ? `${c.valor}%` : fmt(c.valor)}
                  </span>
                  {!c.ativo && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-500">inativo</span>}
                  {expirado && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">expirado</span>}
                  {esgotado && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">esgotado</span>}
                </div>
                <p className="text-xs text-brand-muted mt-1">
                  {c.descricao ? `${c.descricao} · ` : ''}
                  {c.minSubtotal ? `mín. ${fmt(c.minSubtotal)} · ` : ''}
                  usos: {c.usados}{c.usoMaximo != null ? `/${c.usoMaximo}` : ''}
                  {c.validadeAte ? ` · até ${new Date(c.validadeAte).toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              <button onClick={() => toggle(c)} title={c.ativo ? 'Desativar' : 'Ativar'}
                className={`p-2 rounded-lg transition-colors ${c.ativo ? 'text-emerald-600 hover:bg-emerald-500/10' : 'text-gray-400 hover:bg-gray-500/10'}`}>
                <Power size={16} />
              </button>
              <button onClick={() => remover(c)} title="Excluir"
                className="p-2 rounded-lg text-brand-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
