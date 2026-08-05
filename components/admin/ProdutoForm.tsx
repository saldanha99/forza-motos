'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, X, Upload, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { gerarSlug } from '@/lib/utils'
import { Card, SectionTitle, Botao } from '@/components/admin/ui/primitives'
import { Campo, Input, Textarea, Switch, AcoesFormulario } from '@/components/admin/ui/form'

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
  preVenda?: boolean
  prazoEntregaDias?: number | null
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
    preVenda: produto?.preVenda ?? false,
    prazoEntregaDias: produto?.prazoEntregaDias ?? '',
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
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-text">
              <RefreshCw size={14} className="text-brand-info" />
              Sincronizar com Tiny
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Atualiza nome, preço, estoque, imagens, descrição, categoria e marca
            </p>
            {syncResult && !syncResult.error && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand-success">
                <CheckCircle2 size={12} />
                {syncResult.aviso || `${syncResult.campos?.imagens ?? 0} imagens · preço R$${syncResult.campos?.preco?.toFixed(2)} · estoque ${syncResult.campos?.estoque}`}
              </p>
            )}
            {syncResult?.error && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand-danger">
                <AlertCircle size={12} /> {syncResult.error}
              </p>
            )}
          </div>
          <Botao type="button" onClick={handleSyncTiny} disabled={syncLoading} className="shrink-0">
            <RefreshCw size={14} className={syncLoading ? 'animate-spin' : ''} />
            {syncLoading ? 'Sincronizando…' : 'Sync agora'}
          </Botao>
        </Card>
      )}

      {/* Informações básicas */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Informações básicas</SectionTitle>
        <Campo label="Nome" obrigatorio htmlFor="produto-nome">
          <Input id="produto-nome" value={form.nome} onChange={(e) => update('nome', e.target.value)} required />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="SKU" obrigatorio htmlFor="produto-sku">
            <Input id="produto-sku" value={form.sku} onChange={(e) => update('sku', e.target.value)} required />
          </Campo>
          <Campo label="Slug" htmlFor="produto-slug">
            <Input id="produto-slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} />
          </Campo>
        </div>
        <Campo label="Descrição" obrigatorio htmlFor="produto-descricao">
          <Textarea
            id="produto-descricao"
            value={form.descricao}
            onChange={(e) => update('descricao', e.target.value)}
            rows={4}
            required
          />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Categoria" htmlFor="produto-categoria">
            <Input id="produto-categoria" value={form.categoria} onChange={(e) => update('categoria', e.target.value)} placeholder="pneus, oleos, freios..." />
          </Campo>
          <Campo label="Marca" htmlFor="produto-marca">
            <Input id="produto-marca" value={form.marca} onChange={(e) => update('marca', e.target.value)} placeholder="Pirelli, Michelin..." />
          </Campo>
        </div>
      </Card>

      {/* Preços e estoque */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Preços e estoque</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Preço" obrigatorio htmlFor="produto-preco">
            <Input id="produto-preco" type="number" step="0.01" value={form.preco} onChange={(e) => update('preco', Number(e.target.value))} required />
          </Campo>
          <Campo label="Preço promocional" htmlFor="produto-preco-promo">
            <Input id="produto-preco-promo" type="number" step="0.01" value={form.precoPromocional} onChange={(e) => update('precoPromocional', e.target.value)} />
          </Campo>
          <Campo label="Estoque" htmlFor="produto-estoque">
            <Input id="produto-estoque" type="number" value={form.estoque} onChange={(e) => update('estoque', Number(e.target.value))} />
          </Campo>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Switch checked={form.ativo} onChange={(v) => update('ativo', v)} label="Produto ativo" />
          <Switch checked={form.destaque} onChange={(v) => update('destaque', v)} label="Produto em destaque" />
          <Switch checked={form.preVenda} onChange={(v) => update('preVenda', v)} label="Pré-venda" descricao="Vende sem estoque" />
        </div>
        {form.preVenda && (
          <Campo
            label="Prazo de postagem (dias úteis)"
            htmlFor="produto-prazo"
            dica="Produto de pré-venda pode ser comprado mesmo com estoque 0 e aparece em /sorocaba. O estoque não é debitado na compra."
          >
            <Input
              id="produto-prazo"
              type="number"
              value={form.prazoEntregaDias}
              onChange={(e) => update('prazoEntregaDias', e.target.value)}
              placeholder="Ex.: 15"
            />
          </Campo>
        )}
      </Card>

      {/* Imagens */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Imagens</SectionTitle>
        <div className="flex flex-wrap gap-4">
          {imagens.map((img, i) => (
            <div key={i} className="group/img relative h-24 w-24 overflow-hidden rounded-xl border border-brand-border bg-brand-surface-2">
              <Image src={img} alt="" fill sizes="96px" className="object-cover" />
              <button
                type="button"
                onClick={() => setImagens((imgs) => imgs.filter((_, j) => j !== i))}
                className="absolute right-1.5 top-1.5 rounded-lg bg-brand-surface p-1.5 text-brand-muted opacity-0 transition-colors hover:bg-brand-accent hover:text-brand-on-accent group-hover/img:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <label className="group flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-brand-border bg-brand-surface-2 transition hover:border-brand-accent">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImagem(e.target.files[0])}
            />
            {uploadLoading ? (
              <span className="animate-pulse text-xs text-brand-muted">Enviando...</span>
            ) : (
              <>
                <Upload size={20} className="mb-1 text-brand-muted transition-colors group-hover:text-brand-accent" />
                <span className="text-[10px] font-medium text-brand-muted transition-colors group-hover:text-brand-text">Upload</span>
              </>
            )}
          </label>
        </div>
      </Card>

      {/* Compatibilidade */}
      <Card className="space-y-5 p-6">
        <SectionTitle>Compatibilidade com motos</SectionTitle>
        <div className="flex gap-3">
          <Input
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
            className="flex-1"
          />
          <Botao
            type="button"
            variante="secundario"
            onClick={() => {
              if (novaCompat.trim()) {
                setCompatibilidade((c) => [...c, novaCompat.trim()])
                setNovaCompat('')
              }
            }}
          >
            <Plus size={18} />
          </Botao>
        </div>
        <div className="flex flex-wrap gap-2.5 pt-2">
          {compatibilidade.length === 0 ? (
            <p className="text-xs text-brand-dim">Nenhuma compatibilidade listada.</p>
          ) : (
            compatibilidade.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface-2 px-3.5 py-1.5 text-xs text-brand-text transition-colors hover:border-brand-accent">
                {m}
                <button type="button" onClick={() => setCompatibilidade((c) => c.filter((_, j) => j !== i))} className="text-brand-dim transition-colors hover:text-brand-accent">
                  <X size={12} />
                </button>
              </span>
            ))
          )}
        </div>
      </Card>

      <AcoesFormulario>
        <Botao type="button" variante="secundario" tamanho="lg" onClick={() => router.back()}>
          Cancelar
        </Botao>
        <Botao type="submit" tamanho="lg" disabled={loading}>
          {loading ? 'Salvando…' : produto?.id ? 'Salvar alterações' : 'Criar produto'}
        </Botao>
      </AcoesFormulario>
    </form>
  )
}
