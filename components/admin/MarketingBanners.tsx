'use client'

/**
 * Grade de slots de banner do site — o responsável pelo marketing troca a
 * imagem de cada slot sem mexer em código. Upload vai pro storage da VPS
 * via /api/upload (pasta "banners") e a URL é salva em /api/admin/marketing.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { ImagePlus, RotateCcw, Loader2, ExternalLink } from 'lucide-react'

interface Slot {
  chave: string
  nome: string
  dica: string
  fallback: string
  imagemUrl: string | null
}

export function MarketingBanners({ slots: slotsIniciais }: { slots: Slot[] }) {
  const [slots, setSlots] = useState(slotsIniciais)
  const [salvando, setSalvando] = useState<string | null>(null)

  function atualizarLocal(chave: string, imagemUrl: string | null) {
    setSlots((s) => s.map((x) => (x.chave === chave ? { ...x, imagemUrl } : x)))
  }

  async function salvarUrl(chave: string, imagemUrl: string | null) {
    const res = await fetch('/api/admin/marketing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave, imagemUrl }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Erro ao salvar banner')
    }
  }

  async function handleUpload(chave: string, file: File) {
    setSalvando(chave)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('pasta', 'banners')
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      const dataUp = await up.json()
      if (!up.ok) throw new Error(dataUp.error || 'Erro no upload')

      await salvarUrl(chave, dataUp.url)
      atualizarLocal(chave, dataUp.url)
      toast.success('Banner atualizado — já está no ar!')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao trocar banner')
    } finally {
      setSalvando(null)
    }
  }

  async function handleRestaurar(chave: string) {
    setSalvando(chave)
    try {
      await salvarUrl(chave, null)
      atualizarLocal(chave, null)
      toast.success('Banner restaurado para o padrão.')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao restaurar banner')
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {slots.map((slot) => {
        const urlAtual = slot.imagemUrl ?? slot.fallback
        const customizado = Boolean(slot.imagemUrl)
        const ocupado = salvando === slot.chave
        return (
          <div
            key={slot.chave}
            className="bg-brand-card border border-brand-line rounded-xl overflow-hidden"
          >
            {/* Preview */}
            <div className="relative bg-black" style={{ aspectRatio: '21/9' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL dinâmica do storage próprio */}
              <img
                src={urlAtual}
                alt={slot.nome}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {customizado && (
                <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                  Personalizado
                </span>
              )}
              {ocupado && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 size={26} className="text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Infos + ações */}
            <div className="p-4">
              <p className="font-barlow font-bold text-brand-text text-[15px] leading-tight">{slot.nome}</p>
              <p className="text-brand-muted text-xs mt-1">{slot.dica}</p>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <label
                  className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    ocupado
                      ? 'bg-brand-line text-brand-muted cursor-wait'
                      : 'bg-[#d42b2b] hover:bg-red-700 text-white'
                  }`}
                >
                  <ImagePlus size={13} />
                  Trocar imagem
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="hidden"
                    disabled={ocupado}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleUpload(slot.chave, f)
                      e.target.value = ''
                    }}
                  />
                </label>

                {customizado && (
                  <button
                    onClick={() => handleRestaurar(slot.chave)}
                    disabled={ocupado}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg border border-brand-line text-brand-muted hover:text-brand-text transition-colors"
                  >
                    <RotateCcw size={13} />
                    Restaurar padrão
                  </button>
                )}

                <a
                  href={urlAtual}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-muted hover:text-brand-text ml-auto"
                >
                  <ExternalLink size={12} /> ver imagem
                </a>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
