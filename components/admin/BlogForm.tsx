'use client'

import { useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { gerarSlug } from '@/lib/utils'
import { Botao, Card } from '@/components/admin/ui/primitives'
import { AcoesFormulario, Campo, Input, Switch, Textarea } from '@/components/admin/ui/form'

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
      <Card className="space-y-5 p-6">
        <Campo label="Título" obrigatorio>
          <Input value={form.titulo} onChange={(e) => update('titulo', e.target.value)} required />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Slug" dica="Gerado a partir do título — pode editar à mão.">
            <Input value={form.slug} onChange={(e) => update('slug', e.target.value)} />
          </Campo>
          <Campo label="Autor">
            <Input value={form.autor} onChange={(e) => update('autor', e.target.value)} />
          </Campo>
        </div>

        {/* Upload capa */}
        <Campo label="Imagem de capa">
          {form.capaUrl && (
            <div className="relative mb-3 max-h-48 w-full overflow-hidden rounded-xl border border-brand-border">
              <img src={form.capaUrl} alt="capa" className="max-h-48 w-full object-cover" />
              <button
                type="button"
                onClick={() => update('capaUrl', '')}
                className="absolute right-2 top-2 rounded-lg bg-brand-elevated p-1.5 text-brand-text transition-colors hover:bg-brand-accent hover:text-brand-on-accent"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <label className="inline-flex cursor-pointer select-none items-center gap-2.5 rounded-xl border border-brand-border bg-brand-surface-2 px-4 py-2.5 text-sm font-semibold text-brand-text transition hover:border-brand-border-strong hover:bg-brand-elevated">
            <Upload size={16} />
            Enviar capa
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadCapa(e.target.files[0])}
            />
          </label>
        </Campo>

        {/* Conteúdo */}
        <Campo label="Conteúdo (HTML)" obrigatorio dica="Aceita tags HTML — o post renderiza exatamente o que estiver aqui.">
          <Textarea
            value={form.conteudo}
            onChange={(e) => update('conteudo', e.target.value)}
            rows={16}
            required
            className="font-mono"
            placeholder="<p>Seu conteúdo em HTML aqui...</p>"
          />
        </Campo>

        <Switch
          checked={form.publicado}
          onChange={(v) => update('publicado', v)}
          label="Publicar agora"
          descricao="Desligado, o post fica salvo como rascunho e não aparece no blog da loja."
        />
      </Card>

      <AcoesFormulario>
        <Botao type="button" variante="secundario" tamanho="lg" onClick={() => router.back()}>
          Cancelar
        </Botao>
        <Botao type="submit" tamanho="lg" disabled={loading}>
          {loading && <Loader2 size={16} className="animate-spin" />}
          {post?.id ? 'Salvar alterações' : 'Criar post'}
        </Botao>
      </AcoesFormulario>
    </form>
  )
}
