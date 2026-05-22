'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { gerarSlug } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { Plus, X, Upload, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

interface Produto {
  id?: string
  nome?: string
  sku?: string
  slug?: string
  descricao?: string
  preco?: number
  precoPromocional?: number | null
  estoque?: number
  categoria?: string
  marca?: string
  compatibilidadeMotos?: string[]
  imagens?: string[]
  ativo?: boolean
  destaque?: boolean
}

export function ProdutoForm({ produto }: { produto?: Produto }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [form, setForm] = useState({
    nome: produto?.nome ?? '',
    sku: produto?.sku ?? '',
    slug: produto?.slug ?? '',
    descricao: produto?.descricao ?? '',
    preco: produto?.preco ?? 0,
    precoPromocional: produto?.precoPromocional ?? '',
    estoque: produto?.estoque ?? 0,
    categoria: produto?.categoria ?? '',
    marca: produto?.marca ?? '',
    ativo: produto?.ativo ?? true,
    destaque: produto?.destaque ?? false,
  })
  const [compatibilidade, setCompatibilidade] = useState<string[]>(produto?.compatibilidadeMotos ?? [])
  const [imagens, setImagens] = useState<string[]>(produto?.imagens ?? [])
  const [novaCompat, setNovaCompat] = useState('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)

  function update(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }))
    if (field === 'nome') {
      setForm((f) => ({ ...f, slug: gerarSlug(value), nome: value }))
    }
  }

  async function uploadImagem(file: File) {
    setUploadLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setImagens((imgs) => [...imgs, data.url])
      toast.success('Imagem enviada!')
    } catch {
      toast.error('Erro ao enviar imagem')
    } finally {
      setUploadLoading(false)
    }
  }

  async function handleSyncTiny() {
    if (!produto?.id) return
    setSyncLoading(true)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/admin/produtos/${produto.id}/sync`, { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSyncResult(data)
      // Atualiza campos no form com os dados retornados
      if (data.campos.nome)  update('nome', data.campos.nome)
      if (data.campos.preco) update('preco', data.campos.preco)
      if (data.campos.estoque !== undefined) update('estoque', data.campos.estoque)
      if (data.campos.categoria) update('categoria', data.campos.categoria)
      if (data.campos.marca) update('marca', data.campos.marca)
      toast.success('Sincronizado com Tiny!')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao sincronizar')
      setSyncResult({ error: e.message })
    } finally {
      setSyncLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url = produto?.id ? `/api/produtos/${produto.id}` : '/api/produtos'
      const method = produto?.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, compatibilidadeMotos: compatibilidade, imagens }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      toast.success(produto?.id ? 'Produto atualizado!' : 'Produto criado!')
      router.push('/admin/produtos')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar produto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Sync Tiny (só aparece em produtos existentes com tinyId) ── */}
      {produto?.id && (
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-xl">
          <div>
            <p className="text-brand-text font-semibold text-sm flex items-center gap-2">
              <RefreshCw size={14} className="text-blue-400 animate-pulse" />
              Sincronizar com Tiny
            </p>
            <p className="text-xs text-brand-muted mt-1">
              Atualiza nome, preço, estoque, imagens, descrição, categoria e marca
            </p>
            {syncResult && !syncResult.error && (
              <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1.5 font-medium">
                <CheckCircle2 size={12} />
                {syncResult.aviso || `${syncResult.campos?.imagens ?? 0} imagens · preço R$${syncResult.campos?.preco?.toFixed(2)} · estoque ${syncResult.campos?.estoque}`}
              </p>
            )}
            {syncResult?.error && (
              <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1.5 font-medium">
                <AlertCircle size={12} /> {syncResult.error}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSyncTiny}
            disabled={syncLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold uppercase tracking-wider rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/20 active:scale-95 shrink-0"
          >
            <RefreshCw size={14} className={syncLoading ? 'animate-spin' : ''} />
            {syncLoading ? 'Sincronizando…' : 'Sync agora'}
          </button>
        </div>
      )}

      {/* Informações Básicas */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
        <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Informações básicas</h2>
        <Input label="Nome *" value={form.nome} onChange={(e) => update('nome', e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="SKU *" value={form.sku} onChange={(e) => update('sku', e.target.value)} required />
          <Input label="Slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-brand-muted font-medium block mb-1.5">Descrição *</label>
          <textarea
            value={form.descricao}
            onChange={(e) => update('descricao', e.target.value)}
            rows={4}
            required
            className="w-full bg-brand-surface-2 border border-brand-border rounded-xl px-4 py-3 text-brand-text text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 resize-none transition-all duration-200"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Categoria" value={form.categoria} onChange={(e) => update('categoria', e.target.value)} placeholder="pneus, oleos, freios..." />
          <Input label="Marca" value={form.marca} onChange={(e) => update('marca', e.target.value)} placeholder="Pirelli, Michelin..." />
        </div>
      </div>

      {/* Preços e estoque */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
        <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Preços e estoque</h2>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Preço *" type="number" step="0.01" value={form.preco} onChange={(e) => update('preco', Number(e.target.value))} required />
          <Input label="Preço Promocional" type="number" step="0.01" value={form.precoPromocional} onChange={(e) => update('precoPromocional', e.target.value)} />
          <Input label="Estoque" type="number" value={form.estoque} onChange={(e) => update('estoque', Number(e.target.value))} />
        </div>
        <div className="flex gap-6 pt-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} className="w-4 h-4 rounded accent-brand-accent border-brand-border bg-brand-surface-2" />
            <span className="text-sm text-brand-muted group-hover:text-brand-text transition-colors">Produto ativo</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <input type="checkbox" checked={form.destaque} onChange={(e) => update('destaque', e.target.checked)} className="w-4 h-4 rounded accent-brand-accent border-brand-border bg-brand-surface-2" />
            <span className="text-sm text-brand-muted group-hover:text-brand-text transition-colors">Produto em destaque</span>
          </label>
        </div>
      </div>

      {/* Imagens */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
        <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Imagens</h2>
        <div className="flex flex-wrap gap-4">
          {imagens.map((img, i) => (
            <div key={i} className="relative w-24 h-24 bg-brand-surface-2 border border-brand-border rounded-xl overflow-hidden group/img transition-all duration-200 hover:border-brand-accent">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImagens((imgs) => imgs.filter((_, j) => j !== i))}
                className="absolute top-1.5 right-1.5 bg-black/80 hover:bg-brand-accent p-1.5 rounded-lg text-white transition-colors opacity-0 group-hover/img:opacity-100 duration-200"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="w-24 h-24 bg-brand-surface-2 border border-dashed border-brand-border hover:border-brand-accent rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-brand-surface-2/80 transition-all duration-200 group">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImagem(e.target.files[0])}
            />
            {uploadLoading ? (
              <span className="text-xs text-brand-muted animate-pulse">Enviando...</span>
            ) : (
              <>
                <Upload size={20} className="text-brand-muted group-hover:text-brand-accent transition-colors mb-1" />
                <span className="text-[10px] text-brand-muted group-hover:text-brand-text transition-colors font-medium">Upload</span>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Compatibilidade */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-5 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
        <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Compatibilidade com motos</h2>
        <div className="flex gap-3">
          <input
            value={novaCompat}
            onChange={(e) => setNovaCompat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (novaCompat.trim()) {
                  setCompatibilidade((c) => [...c, novaCompat.trim()])
                  setNovaCompat('')
                }
              }
            }}
            placeholder="Ex: Honda CB 300R 2020-2024"
            className="flex-1 bg-brand-surface-2 border border-brand-border rounded-xl px-4 py-2.5 text-brand-text text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 transition-all duration-200"
          />
          <button
            type="button"
            onClick={() => {
              if (novaCompat.trim()) {
                setCompatibilidade((c) => [...c, novaCompat.trim()])
                setNovaCompat('')
              }
            }}
            className="bg-brand-surface-2 hover:bg-brand-surface-3 border border-brand-border hover:border-brand-border-highlight text-brand-text px-4 rounded-xl transition-all duration-200"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2.5 pt-2">
          {compatibilidade.length === 0 ? (
            <p className="text-xs text-brand-muted/70">Nenhuma compatibilidade listada.</p>
          ) : (
            compatibilidade.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 bg-brand-surface-2 text-brand-text border border-brand-border text-xs px-3.5 py-1.5 rounded-full hover:border-brand-accent/50 transition-colors">
                {m}
                <button type="button" onClick={() => setCompatibilidade((c) => c.filter((_, j) => j !== i))} className="hover:text-brand-accent transition-colors">
                  <X size={12} />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" loading={loading} size="lg" className="flex-1 font-bold uppercase tracking-wider text-sm rounded-xl py-4">
          {produto?.id ? 'Salvar alterações' : 'Criar produto'}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()} className="font-bold uppercase tracking-wider text-sm rounded-xl py-4 text-brand-muted hover:text-brand-text hover:bg-brand-surface-2 transition-colors">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
