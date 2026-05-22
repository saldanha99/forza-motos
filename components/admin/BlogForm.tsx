'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { gerarSlug } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Upload, X } from 'lucide-react'

interface Post {
  id?: string
  titulo?: string
  slug?: string
  capaUrl?: string
  conteudo?: string
  autor?: string
  publicado?: boolean
}

export function BlogForm({ post }: { post?: Post }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    titulo: post?.titulo ?? '',
    slug: post?.slug ?? '',
    capaUrl: post?.capaUrl ?? '',
    conteudo: post?.conteudo ?? '',
    autor: post?.autor ?? 'Forza Motos',
    publicado: post?.publicado ?? false,
  })

  function update(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }))
    if (field === 'titulo') {
      setForm((f) => ({ ...f, slug: gerarSlug(value), titulo: value }))
    }
  }

  async function uploadCapa(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      const data = await res.json()
      update('capaUrl', data.url)
      toast.success('Capa enviada!')
    } catch {
      toast.error('Erro ao enviar capa')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url = post?.id ? `/api/blog/${post.id}` : '/api/blog'
      const method = post?.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success(post?.id ? 'Post atualizado!' : 'Post criado!')
      router.push('/admin/blog')
      router.refresh()
    } catch {
      toast.error('Erro ao salvar post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
        <Input label="Título *" value={form.titulo} onChange={(e) => update('titulo', e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
          <Input label="Autor" value={form.autor} onChange={(e) => update('autor', e.target.value)} />
        </div>

        {/* Upload capa */}
        <div>
          <label className="text-sm text-brand-muted font-medium block mb-2">Imagem de capa</label>
          {form.capaUrl && (
            <div className="relative w-full max-h-48 rounded-xl overflow-hidden mb-3 border border-brand-border/30 group/capa">
              <img src={form.capaUrl} alt="capa" className="w-full max-h-48 object-cover" />
              <button
                type="button"
                onClick={() => update('capaUrl', '')}
                className="absolute top-2 right-2 bg-black/80 hover:bg-brand-accent p-1.5 rounded-lg text-white transition-colors duration-200"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <label className="inline-flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-brand-text text-sm px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 font-semibold select-none">
            <Upload size={16} />
            Enviar capa
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCapa(e.target.files[0])} />
          </label>
        </div>

        {/* Conteúdo */}
        <div>
          <label className="text-sm text-brand-muted font-medium block mb-1.5">Conteúdo (HTML) *</label>
          <textarea
            value={form.conteudo}
            onChange={(e) => update('conteudo', e.target.value)}
            rows={16}
            required
            className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-brand-text text-sm font-mono focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 resize-y transition-all duration-200 placeholder:text-brand-muted/50"
            placeholder="<p>Seu conteúdo em HTML aqui...</p>"
          />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none group pt-2">
          <input
            type="checkbox"
            checked={form.publicado}
            onChange={(e) => update('publicado', e.target.checked)}
            className="w-4 h-4 rounded accent-brand-accent border-white/10 bg-white/5"
          />
          <span className="text-sm text-brand-muted group-hover:text-brand-text transition-colors">Publicar agora</span>
        </label>
      </div>

      <div className="flex gap-4">
        <Button type="submit" loading={loading} size="lg" className="flex-1 font-bold uppercase tracking-wider text-sm rounded-xl py-4">
          {post?.id ? 'Salvar alterações' : 'Criar post'}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()} className="font-bold uppercase tracking-wider text-sm rounded-xl py-4 text-brand-muted hover:text-brand-text hover:bg-brand-surface-2 transition-colors">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
