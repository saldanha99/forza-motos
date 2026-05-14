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
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-medium text-sm flex items-center gap-2">
              <RefreshCw size={14} className="text-blue-400" />
              Sincronizar com Tiny
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Atualiza nome, preço, estoque, imagens, descrição, categoria e marca
            </p>
            {syncResult && !syncResult.error && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                <CheckCircle2 size={11} />
                {syncResult.aviso || `${syncResult.campos?.imagens ?? 0} imagens · preço R$${syncResult.campos?.preco?.toFixed(2)} · estoque ${syncResult.campos?.estoque}`}
              </p>
            )}
            {syncResult?.error && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> {syncResult.error}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSyncTiny}
            disabled={syncLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
          >
            <RefreshCw size={13} className={syncLoading ? 'animate-spin' : ''} />
            {syncLoading ? 'Sincronizando…' : 'Sync agora'}
          </button>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="font-rajdhani font-semibold text-lg text-white">Informações básicas</h2>
        <Input label="Nome *" value={form.nome} onChange={(e) => update('nome', e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="SKU *" value={form.sku} onChange={(e) => update('sku', e.target.value)} required />
          <Input label="Slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-zinc-400 font-medium block mb-1">Descrição *</label>
          <textarea
            value={form.descricao}
            onChange={(e) => update('descricao', e.target.value)}
            rows={4}
            required
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-vermelho resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Categoria" value={form.categoria} onChange={(e) => update('categoria', e.target.value)} placeholder="pneus, oleos, freios..." />
          <Input label="Marca" value={form.marca} onChange={(e) => update('marca', e.target.value)} placeholder="Pirelli, Michelin..." />
        </div>
      </div>

      {/* Preços e estoque */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="font-rajdhani font-semibold text-lg text-white">Preços e estoque</h2>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Preço *" type="number" step="0.01" value={form.preco} onChange={(e) => update('preco', Number(e.target.value))} required />
          <Input label="Preço Promocional" type="number" step="0.01" value={form.precoPromocional} onChange={(e) => update('precoPromocional', e.target.value)} />
          <Input label="Estoque" type="number" value={form.estoque} onChange={(e) => update('estoque', Number(e.target.value))} />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={(e) => update('ativo', e.target.checked)} className="accent-vermelho" />
            <span className="text-sm text-zinc-400">Produto ativo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.destaque} onChange={(e) => update('destaque', e.target.checked)} className="accent-vermelho" />
            <span className="text-sm text-zinc-400">Produto em destaque</span>
          </label>
        </div>
      </div>

      {/* Imagens */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="font-rajdhani font-semibold text-lg text-white">Imagens</h2>
        <div className="flex flex-wrap gap-3">
          {imagens.map((img, i) => (
            <div key={i} className="relative w-20 h-20 bg-zinc-800 rounded overflow-hidden">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImagens((imgs) => imgs.filter((_, j) => j !== i))}
                className="absolute top-0 right-0 bg-black/70 p-0.5 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="w-20 h-20 bg-zinc-800 border border-dashed border-zinc-600 rounded flex items-center justify-center cursor-pointer hover:border-zinc-500">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImagem(e.target.files[0])}
            />
            {uploadLoading ? (
              <span className="text-xs text-zinc-500">...</span>
            ) : (
              <Upload size={16} className="text-zinc-500" />
            )}
          </label>
        </div>
      </div>

      {/* Compatibilidade */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="font-rajdhani font-semibold text-lg text-white">Compatibilidade com motos</h2>
        <div className="flex gap-2">
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
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-vermelho"
          />
          <button
            type="button"
            onClick={() => {
              if (novaCompat.trim()) {
                setCompatibilidade((c) => [...c, novaCompat.trim()])
                setNovaCompat('')
              }
            }}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 rounded transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {compatibilidade.map((m, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 bg-zinc-800 text-zinc-300 text-xs px-3 py-1 rounded-full">
              {m}
              <button type="button" onClick={() => setCompatibilidade((c) => c.filter((_, j) => j !== i))}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" loading={loading} size="lg" className="flex-1">
          {produto?.id ? 'Salvar alterações' : 'Criar produto'}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
