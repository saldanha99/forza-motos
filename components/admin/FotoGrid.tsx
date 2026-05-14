'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Link2, X, CheckCircle2, ImageOff, Search } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const [showUrlInput, setShowUrlInput] = useState(false)
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
      setShowUrlInput(false)
      onSaved(produto.id, url.trim())
      toast.success('Foto salva!')
    } catch {
      toast.error('Erro ao salvar URL')
    } finally {
      setUploading(false)
    }
  }

  async function uploadArquivo(file: File) {
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
  }

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
  }, [])

  return (
    <div className={`bg-zinc-900 border rounded-xl overflow-hidden transition-all duration-200 ${
      saved ? 'border-zinc-700' : 'border-zinc-800 hover:border-zinc-600'
    }`}>
      {/* Área da foto */}
      <div
        className={`relative aspect-square cursor-pointer group ${dragging ? 'ring-2 ring-[#d42b2b]' : ''}`}
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
              className="w-full h-full object-cover"
              onError={() => setImgUrl('')}
            />
            {/* Overlay com ações */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
                title="Trocar foto"
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
              >
                <Upload size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowUrlInput(true) }}
                title="Colar URL"
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
              >
                <Link2 size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removerFoto() }}
                title="Remover foto"
                className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {/* Badge salvo */}
            {saved && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 size={18} className="text-green-400 drop-shadow" />
              </div>
            )}
          </>
        ) : (
          /* Placeholder sem foto */
          <div className={`w-full h-full flex flex-col items-center justify-center gap-2 transition-colors ${
            dragging ? 'bg-[#d42b2b]/10' : 'bg-zinc-800 group-hover:bg-zinc-750'
          }`}>
            {uploading ? (
              <div className="w-6 h-6 border-2 border-[#d42b2b] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ImageOff size={28} className="text-zinc-600" />
                <span className="text-[10px] text-zinc-600 text-center px-2">
                  {dragging ? 'Solte aqui' : 'Clique ou arraste'}
                </span>
              </>
            )}
          </div>
        )}

        {/* Loading overlay */}
        {uploading && imgUrl && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
        <p className="text-[11px] text-zinc-500 truncate">{produto.marca}</p>
        <p className="text-[12px] text-white font-medium leading-[1.3] line-clamp-2 min-h-[30px]">
          {produto.nome}
        </p>
        <p className="text-[10px] text-zinc-600 font-mono mt-0.5 truncate">{produto.sku}</p>

        {/* URL Input rápido */}
        {showUrlInput ? (
          <div className="mt-2 flex gap-1">
            <input
              autoFocus
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') salvarUrl(urlInput)
                if (e.key === 'Escape') setShowUrlInput(false)
              }}
              placeholder="Cole a URL da imagem..."
              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#d42b2b]"
            />
            <button
              onClick={() => salvarUrl(urlInput)}
              disabled={uploading}
              className="bg-[#d42b2b] text-white px-2 py-1 rounded text-[10px] font-bold disabled:opacity-50"
            >
              OK
            </button>
            <button
              onClick={() => setShowUrlInput(false)}
              className="text-zinc-600 hover:text-white px-1"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowUrlInput(true)}
            className="mt-1.5 w-full flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <Link2 size={10} /> Colar URL
          </button>
        )}
      </div>
    </div>
  )
}

export function FotoGrid({ produtos: inicial, totalSemFoto, totalComFoto, total }: FotoGridProps) {
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-zinc-400 text-sm">Progresso de fotos</p>
            <p className="text-white font-bold text-lg">
              {comFoto} <span className="text-zinc-500 font-normal text-base">de {total} produtos</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-[#d42b2b]">{pct}%</p>
            <p className="text-zinc-500 text-xs">{total - comFoto} sem foto</p>
          </div>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#d42b2b] rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Filtros + busca */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-1">
          {(['semFoto', 'todos', 'comFoto'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filtro === f
                  ? 'bg-[#d42b2b] text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f === 'semFoto' ? `Sem foto (${total - comFoto})` :
               f === 'comFoto' ? `Com foto (${comFoto})` : 'Todos'}
            </button>
          ))}
        </div>

        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou SKU..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#d42b2b]"
          />
        </div>
      </div>

      {/* Info drag & drop */}
      <p className="text-xs text-zinc-600 mb-4">
        💡 Clique na foto para escolher arquivo · Arraste a imagem direto no card · Ou cole uma URL com o botão abaixo
      </p>

      {/* Grade */}
      {visíveis.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">
          <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500/50" />
          <p className="text-lg font-medium text-zinc-400">
            {filtro === 'semFoto' ? 'Todos os produtos têm foto! 🎉' : 'Nenhum produto encontrado'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {visíveis.slice(0, 120).map((p) => (
            <ProdutoCard key={p.id} produto={p} onSaved={handleSaved} />
          ))}
        </div>
      )}

      {visíveis.length > 120 && (
        <p className="text-center text-zinc-500 text-sm mt-6">
          Mostrando 120 de {visíveis.length} — use a busca para filtrar
        </p>
      )}
    </div>
  )
}
