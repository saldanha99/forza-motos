'use client'

/**
 * Grade de slots de banner do site — o responsável pelo marketing troca a
 * imagem de cada slot sem mexer em código. Upload vai pro storage da VPS
 * via /api/upload (pasta "banners") e a URL é salva em /api/admin/marketing.
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import { ImagePlus, RotateCcw, Loader2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Card, Badge, Botao, BOTAO_BASE, BOTAO_VARIANTE, BOTAO_TAMANHO,
} from '@/components/admin/ui/primitives'

// O disparador do upload precisa ser um <label> (para abrir o file input), e
// <Botao> é sempre um <button> — daí reaproveitarmos só as classes.
const BASE_BOTAO_LABEL = BOTAO_BASE

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
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {slots.map((slot) => {
        const urlAtual = slot.imagemUrl ?? slot.fallback
        const customizado = Boolean(slot.imagemUrl)
        const ocupado = salvando === slot.chave
        return (
          <Card key={slot.chave} className="overflow-hidden">
            {/* Preview — fundo fixo escuro: o banner é uma peça gráfica publicada
                sobre o hero do site, então o preview usa sempre o mesmo fundo
                (não um token que troca de tema) para representar fielmente
                como a arte aparece na loja. */}
            <div className="relative bg-brand-sidebar" style={{ aspectRatio: '21/9' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL dinâmica do storage próprio */}
              <img
                src={urlAtual}
                alt={slot.nome}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {customizado && (
                <Badge tom="success" className="absolute left-2 top-2">
                  Personalizado
                </Badge>
              )}
              {ocupado && (
                <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--brand-overlay)]">
                  <Loader2 size={26} className="animate-spin text-brand-on-accent" />
                </div>
              )}
            </div>

            {/* Infos + ações */}
            <div className="p-4">
              <p className="font-barlow text-[15px] font-bold leading-tight text-brand-text">{slot.nome}</p>
              <p className="mt-1 text-xs text-brand-muted">{slot.dica}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label
                  className={cn(
                    BASE_BOTAO_LABEL,
                    BOTAO_VARIANTE.primario,
                    BOTAO_TAMANHO.sm,
                    'cursor-pointer',
                    ocupado && 'pointer-events-none opacity-50',
                  )}
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
                  <Botao
                    type="button"
                    variante="secundario"
                    tamanho="sm"
                    onClick={() => handleRestaurar(slot.chave)}
                    disabled={ocupado}
                  >
                    <RotateCcw size={13} />
                    Restaurar padrão
                  </Botao>
                )}

                <a
                  href={urlAtual}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs text-brand-muted hover:text-brand-text"
                >
                  <ExternalLink size={12} /> ver imagem
                </a>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
