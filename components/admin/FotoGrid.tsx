'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Link2, X, CheckCircle2, ImageOff, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Card, EmptyState } from '@/components/admin/ui/primitives'
import { Input, GrupoOpcoes } from '@/components/admin/ui/form'

interface Produto {
  id: string
  nome: string
  sku: string
  marca: string
  categoria: string
  imagens: string[]
  temImagem: boolean
}

interface FotoGridProps {
  produtos: Produto[]
  totalSemFoto: number
  totalComFoto: number
  total: number
}

function ProdutoCard({ produto, onSaved }: { produto: Produto; onSaved: (id: string, url: string) => void }) {
  const [imgUrl, setImgUrl] = useState<string>(produto.imagens?.[0] ?? '')
  const [urlInput, setUrlInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(produto.temImagem)
  const [openUrl, setOpenUrl] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function salvarUrl(url: string) {
    if (!url.trim()) return
    setUploading(true)
    try {
      const res = await fetch(`/api/admin/produtos/${produto.id}/foto`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      if (!res.ok) throw new Error()
      setImgUrl(url.trim())
      setSaved(true)
      setUrlInput('')
      setOpenUrl(false)
      onSaved(produto.id, url.trim())
      toast.success('Foto salva!')
    } catch {
      toast.error('Erro ao salvar URL')
    } finally {
      setUploading(false)
    }
  }

  // Estabilizada com useCallback (deps: produto.id, onSaved) para que handleDrop
  // possa declarar a dependência sem recriar sua referência a cada render.
  const uploadArquivo = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/admin/produtos/${produto.id}/foto`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Erro no upload')
      }
      const data = await res.json()
      setImgUrl(data.uploadUrl ?? data.imagens?.[0] ?? '')
      setSaved(true)
      onSaved(produto.id, data.uploadUrl ?? '')
      toast.success('Foto enviada!')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar arquivo')
    } finally {
      setUploading(false)
    }
  }, [produto.id, onSaved])

  async function removerFoto() {
    try {
      await fetch(`/api/admin/produtos/${produto.id}/foto`, { method: 'DELETE' })
      setImgUrl('')
      setSaved(false)
      onSaved(produto.id, '')
      toast.success('Foto removida')
    } catch {
      toast.error('Erro ao remover foto')
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) uploadArquivo(file)
  }, [uploadArquivo])

  return (
    <Card
      className={cn(
        'overflow-hidden p-0 transition-colors',
        // Produto sem foto é o problema que esta tela existe para resolver —
        // a borda em brand-danger faz ele saltar aos olhos na grade.
        saved ? 'border-brand-border' : 'border-2 border-brand-danger',
      )}
    >
      {/* Área da foto */}
      <div
        className={cn(
          'group relative aspect-square cursor-pointer',
          dragging && 'ring-2 ring-brand-accent',
        )}
        onClick={() => !imgUrl && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {imgUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt={produto.nome}
              className="h-full w-full object-cover"
              onError={() => setImgUrl('')}
            />
            {/* Overlay com ações */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[color:var(--brand-overlay)] opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
                title="Trocar foto"
                className="rounded-lg bg-brand-surface p-2 text-brand-text transition-colors hover:bg-brand-accent hover:text-brand-on-accent"
              >
                <Upload size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenUrl(true) }}
                title="Colar URL"
                className="rounded-lg bg-brand-surface p-2 text-brand-text transition-colors hover:bg-brand-accent hover:text-brand-on-accent"
              >
                <Link2 size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removerFoto() }}
                title="Remover foto"
                className="rounded-lg bg-brand-surface p-2 text-brand-danger transition-colors hover:bg-brand-danger hover:text-brand-on-accent"
              >
                <X size={16} />
              </button>
            </div>
            {/* Badge salvo */}
            {saved && (
              <div className="absolute right-2 top-2">
                <CheckCircle2 size={18} className="text-brand-success" />
              </div>
            )}
          </>
        ) : (
          /* Placeholder sem foto */
          <div
            className={cn(
              'flex h-full w-full flex-col items-center justify-center gap-2 transition-colors',
              dragging ? 'bg-brand-accent-soft' : 'bg-brand-surface-2',
            )}
          >
            {uploading ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-accent border-t-transparent" />
            ) : (
              <>
                <ImageOff size={28} className="text-brand-danger" />
                <span className="px-2 text-center text-[10px] font-semibold text-brand-danger">
                  {dragging ? 'Solte aqui' : 'Sem foto — clique ou arraste'}
                </span>
              </>
            )}
          </div>
        )}

        {/* Loading overlay */}
        {uploading && imgUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--brand-overlay)]">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-on-accent border-t-transparent" />
          </div>
        )}
      </div>

      {/* Input oculto de arquivo */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadArquivo(file)
          e.target.value = ''
        }}
      />

      {/* Info do produto */}
      <div className="p-2.5">
        <p className="truncate text-[11px] text-brand-muted">{produto.marca}</p>
        <p className="min-h-[30px] text-[12px] font-medium leading-[1.3] text-brand-text line-clamp-2">
          {produto.nome}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-brand-dim">{produto.sku}</p>

        {/* URL Input rápido */}
        {openUrl ? (
          <div className="mt-2 flex gap-1">
            <input
              autoFocus
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvarUrl(urlInput)
                if (e.key === 'Escape') setOpenUrl(false)
              }}
              placeholder="URL da imagem..."
              className="min-w-0 flex-1 rounded border border-brand-border bg-brand-surface-2 px-2 py-1 text-[11px] text-brand-text outline-none focus:border-brand-accent"
            />
            <button
              onClick={() => salvarUrl(urlInput)}
              disabled={uploading}
              className="rounded bg-brand-accent px-2 py-1 text-[10px] font-bold text-brand-on-accent disabled:opacity-50"
            >
              OK
            </button>
            <button
              onClick={() => setOpenUrl(false)}
              className="px-1 text-brand-muted hover:text-brand-text"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpenUrl(true)}
            className="mt-1.5 flex w-full items-center gap-1 text-[10px] text-brand-dim transition-colors hover:text-brand-text"
          >
            <Link2 size={10} /> Colar URL
          </button>
        )}
      </div>
    </Card>
  )
}

export function FotoGrid({ produtos: inicial, totalComFoto, total }: FotoGridProps) {
  const [produtos, setProdutos] = useState(inicial)
  const [comFoto, setComFoto] = useState(totalComFoto)
  const [filtro, setFiltro] = useState<'todos' | 'semFoto' | 'comFoto'>('semFoto')
  const [busca, setBusca] = useState('')

  function handleSaved(id: string, url: string) {
    setProdutos((prev) =>
      prev.map((p) => p.id === id ? { ...p, imagens: url ? [url] : [], temImagem: !!url } : p)
    )
    setComFoto((n) => url ? n + 1 : n - 1)
  }

  const visíveis = produtos.filter((p) => {
    const passaFiltro =
      filtro === 'todos' ? true :
      filtro === 'semFoto' ? !p.temImagem :
      p.temImagem
    const passaBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || p.sku.toLowerCase().includes(busca.toLowerCase())
    return passaFiltro && passaBusca
  })

  const pct = total > 0 ? ((comFoto / total) * 100).toFixed(1) : '0'

  return (
    <div>
      {/* Stats bar */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-muted">Progresso de fotos</p>
            <p className="text-lg font-bold text-brand-text">
              {comFoto} <span className="text-base font-normal text-brand-muted">de {total} produtos</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-brand-accent">{pct}%</p>
            <p className="text-xs text-brand-muted">{total - comFoto} sem foto</p>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full border border-brand-border bg-brand-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accent-hover transition duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      {/* Filtros + busca */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <GrupoOpcoes
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: 'semFoto', label: `Sem foto (${total - comFoto})` },
            { valor: 'todos', label: 'Todos' },
            { valor: 'comFoto', label: `Com foto (${comFoto})` },
          ]}
        />

        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dim" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou SKU..."
            className="pl-8"
          />
        </div>
      </div>

      {/* Grade */}
      {visíveis.length === 0 ? (
        <EmptyState
          icone={filtro === 'semFoto' ? CheckCircle2 : ImageOff}
          titulo={filtro === 'semFoto' ? 'Todos os produtos têm foto' : 'Nenhum produto encontrado'}
          descricao={
            filtro === 'semFoto'
              ? 'Um produto aparece aqui quando está ativo na loja e ainda não tem imagem cadastrada.'
              : 'Ajuste o filtro ou a busca para ver outros produtos.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visíveis.slice(0, 120).map((p) => (
            <ProdutoCard key={p.id} produto={p} onSaved={handleSaved} />
          ))}
        </div>
      )}

      {visíveis.length > 120 && (
        <p className="mt-6 text-center text-sm text-brand-muted">
          Mostrando 120 de {visíveis.length} — use a busca para filtrar
        </p>
      )}
    </div>
  )
}
