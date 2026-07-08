'use client'

/**
 * Carrossel de fotos do evento — roteiro, passeios anteriores e pontos visitados.
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Images } from 'lucide-react'

export function EventoGaleria({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  const [idx, setIdx] = useState(0)
  if (fotos.length === 0) return null

  const prev = () => setIdx((i) => (i - 1 + fotos.length) % fotos.length)
  const next = () => setIdx((i) => (i + 1) % fotos.length)

  return (
    <div className="mb-10">
      <h2 className="flex items-center gap-2 font-barlow font-bold text-xl text-[#111] mb-4">
        <Images size={18} className="text-[#d42b2b]" />
        Roteiro e passeios anteriores
      </h2>

      <div className="relative rounded-2xl overflow-hidden bg-[#f5f5f5]" style={{ aspectRatio: '16/9' }}>
        <img src={fotos[idx]} alt={`${titulo} — foto ${idx + 1}`} className="w-full h-full object-cover" />

        {fotos.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {fotos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Ir para foto ${i + 1}`}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{ background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)' }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {fotos.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {fotos.map((f, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="shrink-0 rounded-lg overflow-hidden border-2 transition-colors"
              style={{ borderColor: i === idx ? '#d42b2b' : 'transparent', width: 72, height: 54 }}
            >
              <img src={f} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
