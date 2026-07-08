'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { gerarSlug } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Upload, X, Plus, ImagePlus } from 'lucide-react'

const CATEGORIAS = ['Curso', 'Passeio', 'Viagem', 'Evento', 'Corrida', 'Encontro', 'Workshop']

interface Evento {
  id?: string
  titulo?: string
  slug?: string
  descricao?: string
  conteudo?: string
  dataInicio?: string
  dataFim?: string | null
  local?: string
  endereco?: string | null
  imagemUrl?: string | null
  galeria?: string[] | null
  opcoesVaga?: { label: string; preco: number }[] | null
  preco?: number | string
  categoria?: string
  vagas?: number | null
  linkExterno?: string | null
  ativo?: boolean
  publicado?: boolean
  destaque?: boolean
}

function toInputDate(val?: string | null) {
  if (!val) return ''
  return new Date(val).toISOString().slice(0, 16)
}

export function EventoForm({ evento }: { evento?: Evento }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    titulo: evento?.titulo ?? '',
    slug: evento?.slug ?? '',
    descricao: evento?.descricao ?? '',
    conteudo: evento?.conteudo ?? '',
    dataInicio: toInputDate(evento?.dataInicio),
    dataFim: toInputDate(evento?.dataFim),
    local: evento?.local ?? '',
    endereco: evento?.endereco ?? '',
    imagemUrl: evento?.imagemUrl ?? '',
    galeria: (evento?.galeria ?? []) as string[],
    opcoesVaga: (evento?.opcoesVaga ?? []) as { label: string; preco: number }[],
    preco: String(evento?.preco ?? '0'),
    categoria: evento?.categoria ?? 'Evento',
    vagas: String(evento?.vagas ?? ''),
    linkExterno: evento?.linkExterno ?? '',
    ativo: evento?.ativo ?? true,
    publicado: evento?.publicado ?? false,
    destaque: evento?.destaque ?? false,
  })

  function update(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }))
    if (field === 'titulo') {
      setForm((f) => ({ ...f, slug: gerarSlug(value), titulo: value }))
    }
  }

  async function uploadImagem(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('pasta', 'eventos')
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      const data = await res.json()
      update('imagemUrl', data.url)
      toast.success('Imagem enviada!')
    } catch {
      toast.error('Erro ao enviar imagem')
    }
  }

  async function uploadGaleria(files: FileList) {
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pasta', 'eventos')
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setForm((f) => ({ ...f, galeria: [...f.galeria, data.url] }))
      } catch {
        toast.error(`Erro ao enviar ${file.name}`)
      }
    }
    toast.success('Fotos adicionadas à galeria!')
  }

  function removerDaGaleria(idx: number) {
    setForm((f) => ({ ...f, galeria: f.galeria.filter((_, i) => i !== idx) }))
  }

  function addOpcaoVaga() {
    setForm((f) => ({ ...f, opcoesVaga: [...f.opcoesVaga, { label: '', preco: Number(f.preco) || 0 }] }))
  }
  function updateOpcaoVaga(idx: number, campo: 'label' | 'preco', valor: string) {
    setForm((f) => ({
      ...f,
      opcoesVaga: f.opcoesVaga.map((o, i) => (i === idx ? { ...o, [campo]: campo === 'preco' ? Number(valor) || 0 : valor } : o)),
    }))
  }
  function removerOpcaoVaga(idx: number) {
    setForm((f) => ({ ...f, opcoesVaga: f.opcoesVaga.filter((_, i) => i !== idx) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url = evento?.id ? `/api/admin/eventos/${evento.id}` : '/api/admin/eventos'
      const method = evento?.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          preco: parseFloat(form.preco) || 0,
          vagas: form.vagas ? parseInt(form.vagas) : null,
          dataFim: form.dataFim || null,
          endereco: form.endereco || null,
          imagemUrl: form.imagemUrl || null,
          galeria: form.galeria,
          opcoesVaga: form.opcoesVaga.filter((o) => o.label.trim()),
          linkExterno: form.linkExterno || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(evento?.id ? 'Evento atualizado!' : 'Evento criado!')
      router.push('/admin/eventos')
      router.refresh()
    } catch {
      toast.error('Erro ao salvar evento')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!evento?.id) return
    if (!confirm('Excluir este evento? Esta ação não pode ser desfeita.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/eventos/${evento.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Evento excluído!')
      router.push('/admin/eventos')
      router.refresh()
    } catch {
      toast.error('Erro ao excluir evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dados principais */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl">
        <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-widest">Dados do evento</h2>

        <Input label="Título *" value={form.titulo} onChange={(e) => update('titulo', e.target.value)} required />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
          <div>
            <label className="text-sm text-brand-muted font-medium block mb-1.5">Categoria</label>
            <select
              value={form.categoria}
              onChange={(e) => update('categoria', e.target.value)}
              className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-all duration-200"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c} className="bg-[#0a0a0a]">{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-brand-muted font-medium block mb-1.5">Descrição curta *</label>
          <textarea
            value={form.descricao}
            onChange={(e) => update('descricao', e.target.value)}
            rows={3}
            required
            className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-brand-text text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 resize-none transition-all duration-200 placeholder:text-brand-muted/50"
            placeholder="Breve descrição do evento (aparece na listagem)"
          />
        </div>
      </div>

      {/* Data e local */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl">
        <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-widest">Data e local</h2>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data de início *"
            type="datetime-local"
            value={form.dataInicio}
            onChange={(e) => update('dataInicio', e.target.value)}
            required
          />
          <Input
            label="Data de término"
            type="datetime-local"
            value={form.dataFim}
            onChange={(e) => update('dataFim', e.target.value)}
          />
        </div>

        <Input label="Local *" value={form.local} onChange={(e) => update('local', e.target.value)} required placeholder="Ex: Kartódromo Granja Viana" />
        <Input label="Endereço completo" value={form.endereco} onChange={(e) => update('endereco', e.target.value)} placeholder="Rua, número, cidade, estado" />
      </div>

      {/* Preço e inscrição */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl">
        <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-widest">Preço e inscrição</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-brand-muted font-medium block mb-1.5">Preço (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.preco}
              onChange={(e) => update('preco', e.target.value)}
              className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-all duration-200"
              placeholder="0 = gratuito"
            />
          </div>
          <div>
            <label className="text-sm text-brand-muted font-medium block mb-1.5">Vagas disponíveis</label>
            <input
              type="number"
              min="1"
              value={form.vagas}
              onChange={(e) => update('vagas', e.target.value)}
              className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-all duration-200"
              placeholder="Deixe vazio = sem limite"
            />
          </div>
        </div>

        <Input
          label="Link de inscrição externo (opcional)"
          value={form.linkExterno}
          onChange={(e) => update('linkExterno', e.target.value)}
          placeholder="https://..."
        />
      </div>

      {/* Imagem */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl">
        <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-widest">Imagem de capa</h2>

        {form.imagemUrl && (
          <div className="relative rounded-xl overflow-hidden border border-brand-border/30 group/img">
            <img src={form.imagemUrl} alt="capa" className="w-full max-h-56 object-cover" />
            <button
              type="button"
              onClick={() => update('imagemUrl', '')}
              className="absolute top-2 right-2 bg-black/80 hover:bg-brand-accent p-1.5 rounded-lg text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <label className="inline-flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-brand-text text-sm px-4 py-2.5 rounded-xl cursor-pointer transition-all font-semibold select-none">
          <Upload size={16} />
          Enviar imagem
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImagem(e.target.files[0])} />
        </label>
      </div>

      {/* Galeria / carrossel */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl">
        <div>
          <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-widest">Galeria (carrossel)</h2>
          <p className="text-xs text-brand-muted/70 mt-1">
            Fotos de passeios anteriores, roteiro e pontos que serão visitados — aparecem em carrossel na página do evento.
          </p>
        </div>

        {form.galeria.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {form.galeria.map((url, idx) => (
              <div key={url + idx} className="relative rounded-xl overflow-hidden border border-brand-border/30 aspect-square group/img">
                <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removerDaGaleria(idx)}
                  className="absolute top-1.5 right-1.5 bg-black/80 hover:bg-brand-accent p-1 rounded-lg text-white transition-colors opacity-0 group-hover/img:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="inline-flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-brand-text text-sm px-4 py-2.5 rounded-xl cursor-pointer transition-all font-semibold select-none">
          <ImagePlus size={16} />
          Adicionar fotos
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && e.target.files.length > 0 && uploadGaleria(e.target.files)}
          />
        </label>
      </div>

      {/* Opções de vaga */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl">
        <div>
          <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-widest">Opções de vaga (evento pago)</h2>
          <p className="text-xs text-brand-muted/70 mt-1">
            Ex: "Sozinho" (piloto só), "Com garupa" (+1 pessoa), "Quarto dividido em 4" (preço por pessoa).
            Se deixar vazio, o cliente só escolhe a quantidade pelo preço base.
          </p>
        </div>

        {form.opcoesVaga.map((op, idx) => (
          <div key={idx} className="flex gap-3 items-center">
            <input
              value={op.label}
              onChange={(e) => updateOpcaoVaga(idx, 'label', e.target.value)}
              placeholder="Ex: Com garupa"
              className="flex-1 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-all duration-200"
            />
            <div className="relative w-40">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted text-sm">R$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={op.preco}
                onChange={(e) => updateOpcaoVaga(idx, 'preco', e.target.value)}
                className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-xl pl-9 pr-3 py-2.5 text-brand-text text-sm focus:outline-none focus:border-brand-accent transition-all duration-200"
              />
            </div>
            <button
              type="button"
              onClick={() => removerOpcaoVaga(idx)}
              className="p-2.5 rounded-xl text-brand-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addOpcaoVaga}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-accent hover:text-brand-accent-hover transition-colors"
        >
          <Plus size={15} /> Adicionar opção de vaga
        </button>
      </div>

      {/* Conteúdo */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl">
        <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-widest">Conteúdo completo (HTML)</h2>
        <textarea
          value={form.conteudo}
          onChange={(e) => update('conteudo', e.target.value)}
          rows={14}
          className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-brand-text text-sm font-mono focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 resize-y transition-all duration-200 placeholder:text-brand-muted/50"
          placeholder="<p>Programação, roteiro, inclui e não inclui...</p>"
        />
      </div>

      {/* Flags */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-widest mb-4">Configurações</h2>
        <div className="flex flex-wrap gap-6">
          {[
            { field: 'publicado', label: 'Publicar no site' },
            { field: 'destaque', label: 'Destacar na home' },
            { field: 'ativo', label: 'Ativo' },
          ].map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={form[field as keyof typeof form] as boolean}
                onChange={(e) => update(field, e.target.checked)}
                className="w-4 h-4 rounded accent-brand-accent border-white/10 bg-white/5"
              />
              <span className="text-sm text-brand-muted group-hover:text-brand-text transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" loading={loading} size="lg" className="flex-1 font-bold uppercase tracking-wider text-sm rounded-xl py-4">
          {evento?.id ? 'Salvar alterações' : 'Criar evento'}
        </Button>
        {evento?.id && (
          <Button type="button" variant="ghost" size="lg" onClick={handleDelete} loading={loading} className="font-bold text-sm rounded-xl py-4 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors px-6">
            Excluir
          </Button>
        )}
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()} className="font-bold uppercase tracking-wider text-sm rounded-xl py-4 text-brand-muted hover:text-brand-text hover:bg-brand-surface-2 transition-colors">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
