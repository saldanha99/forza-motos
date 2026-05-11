'use client'

import { MessageCircle } from 'lucide-react'

export function WhatsappButton() {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP ?? '5519974049445'

  return (
    <a
      href={`https://wa.me/${numero}?text=Olá!%20Vim%20pelo%20site%20da%20Forza%20Motos%20e%20gostaria%20de%20mais%20informações.`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg shadow-green-500/30 transition-all duration-200 hover:scale-110"
    >
      <MessageCircle size={24} />
    </a>
  )
}
