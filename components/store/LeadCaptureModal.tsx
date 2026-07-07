'use client'

import { useState, useEffect } from 'react'
import { X, MessageCircle } from 'lucide-react'

const STORAGE_KEY = 'forza_lead_captured'
const DELAY_MS = 30_000 // aparece após 30s

export function LeadCaptureModal() {
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    // Não mostra se já capturou antes
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) return

    const timer = setTimeout(() => setOpen(true), DELAY_MS)

    // Exit intent (mouse sai pelo topo)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !localStorage.getItem(STORAGE_KEY)) {
        setOpen(true)
        clearTimeout(timer)
      }
    }
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  function fechar() {
    setOpen(false)
    // Não mostra de novo por 7 dias se fechar sem preencher
    localStorage.setItem(STORAGE_KEY, 'dismissed')
    setTimeout(() => localStorage.removeItem(STORAGE_KEY), 7 * 24 * 60 * 60 * 1000)
  }

  function formatarWhatsApp(val: string) {
    const nums = val.replace(/\D/g, '').slice(0, 11)
    if (nums.length <= 2) return `(${nums}`
    if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/crm/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          whatsapp: whatsapp.replace(/\D/g, ''),
          origem: 'POPUP',
          utmSource: new URLSearchParams(window.location.search).get('utm_source') ?? undefined,
          utmMedium: new URLSearchParams(window.location.search).get('utm_medium') ?? undefined,
          utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') ?? undefined,
        }),
      })

      if (!res.ok) throw new Error('Erro ao salvar')

      setSucesso(true)
      localStorage.setItem(STORAGE_KEY, 'captured')
      setTimeout(() => setOpen(false), 3000)
    } catch {
      setErro('Não foi possível salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={fechar}
      />

      {/* Modal */}
      <div
        className="fixed z-50 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{
          bottom: '50%',
          left: '50%',
          transform: 'translate(-50%, 50%)',
        }}
      >
        {/* Header vermelho */}
        <div
          className="relative px-6 pt-6 pb-5 text-white"
          style={{ background: 'linear-gradient(135deg, #d42b2b 0%, #b01f1f 100%)' }}
        >
          <button
            onClick={fechar}
            className="absolute top-4 right-4 p-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircle size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Forza Motos</p>
              <p className="font-bold text-lg leading-tight">Frete grátis acima de R$499!</p>
            </div>
          </div>
          <p className="text-sm opacity-90">
            Frete grátis para SP em compras acima de R$499. Deixe seu WhatsApp e receba ofertas exclusivas e dicas de manutenção. 🏍️
          </p>
        </div>

        {/* Body */}
        <div className="bg-white px-6 py-5">
          {sucesso ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-bold text-[#111]">Perfeito, {nome.split(' ')[0]}!</p>
              <p className="text-sm text-[#666] mt-1">
                Em instantes você receberá uma mensagem no WhatsApp. 😊
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                  style={{ borderColor: '#ddd', color: '#111' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#d42b2b' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#ddd' }}
                />
              </div>
              <div>
                <input
                  type="tel"
                  placeholder="(19) 99999-9999"
                  value={whatsapp}
                  onChange={e => setWhatsapp(formatarWhatsApp(e.target.value))}
                  required
                  minLength={14}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                  style={{ borderColor: '#ddd', color: '#111' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#d42b2b' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#ddd' }}
                />
              </div>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-opacity"
                style={{ background: '#d42b2b', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Enviando...' : '🎉 Quero frete grátis!'}
              </button>

              <p className="text-center text-[10px] text-[#aaa]">
                Sem spam. Pode cancelar quando quiser.
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
