'use client'

import { MessageCircle } from 'lucide-react'

/**
 * CTA de WhatsApp contextual para a página do glossário.
 * Monta uma mensagem pré-preenchida citando o termo que o usuário está lendo,
 * aumentando a taxa de resposta ("Vi sobre X no site e quero saber mais").
 */
export function CtaWhatsapp({ termo, variante = 'bloco' }: { termo: string; variante?: 'bloco' | 'compacto' }) {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP ?? '5519974049445'
  const msg = `Olá! Estava lendo sobre *${termo}* no site da Forza Motos e gostaria de tirar uma dúvida com um especialista.`
  const href = `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`

  if (variante === 'compacto') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full rounded-xl py-3 px-4 font-bold text-sm text-white transition-all hover:brightness-110"
        style={{ background: '#22c55e' }}
      >
        <MessageCircle size={16} />
        Falar com especialista
      </a>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-2xl p-5 border transition-all hover:shadow-md group"
      style={{ borderColor: 'rgba(34,197,94,0.30)', background: 'rgba(34,197,94,0.05)' }}
    >
      <div
        className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white"
        style={{ background: '#22c55e' }}
      >
        <MessageCircle size={22} />
      </div>
      <div className="min-w-0">
        <p className="font-barlow font-bold text-[15px] text-[#111] leading-tight">
          Ficou com dúvida sobre {termo}?
        </p>
        <p className="text-[13px] text-[#666] mt-0.5">
          Fale agora com um especialista da Forza Motos no WhatsApp.
        </p>
      </div>
    </a>
  )
}
