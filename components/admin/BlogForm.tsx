'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { gerarSlug } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'

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
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) return
    const data = await res.json()
    update('capaUrl', data.url)
    toast.success('Capa enviada!')
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <Input label="Título *" value={form.titulo} onChange={(e) => update('titulo', e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
          <Input label="Autor" value={form.autor} onChange={(e) => update('autor', e.target.value)} />
        </div>

        {/* Upload capa */}
        <div>
          <label className="text-sm text-zinc-400 font-medium block mb-1">Imagem de capa</label>
          {form.capaUrl && (
            <img src={form.capaUrl} alt="capa" className="w-full max-h-40 object-cover rounded mb-2" />
          )}
          <label className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-3 py-2 rounded cursor-pointer transition-colors">
            <Upload size={14} />
            Enviar capa
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCapa(e.target.files[0])} />
          </label>
        </div>

        {/* Conteúdo */}
        <div>
          <label className="text-sm text-zinc-400 font-medium block mb-1">Conteúdo (HTML) *</label>
          <textarea
            value={form.conteudo}
            onChange={(e) => update('conteudo', e.target.value)}
            rows={16}
            required
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-vermelho resize-y"
            placeholder="<p>Seu conteúdo em HTML aqui...</p>"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.publicado}
            onChange={(e) => update('publicado', e.target.checked)}
            className="accent-vermelho"
          />
          <span className="text-sm text-zinc-400">Publicar agora</span>
        </label>
      </div>

      <div className="flex gap-4">
        <Button type="submit" loading={loading} size="lg" className="flex-1">
          {post?.id ? 'Salvar alterações' : 'Criar post'}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
