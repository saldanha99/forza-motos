'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, MapPin, Tag, ChevronRight, Users } from 'lucide-react'

interface Evento {
  id: string
  titulo: string
  slug: string
  descricao: string
  dataInicio: string
  dataFim: string | null
  local: string
  imagemUrl: string | null
  preco: number
  categoria: string
  vagas: number | null
  destaque: boolean
}

function formatData(iso: string) {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
}

function formatHora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function getMes(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(iso))
}

function getMesKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function precoLabel(preco: number) {
  if (preco === 0) return { texto: 'Gratuito', cor: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
  if (preco < 50) return { texto: `R$ ${preco.toFixed(2)}`, cor: 'text-blue-600 bg-blue-50 border-blue-200' }
  return { texto: `R$ ${preco.toFixed(2)}`, cor: 'text-[#d42b2b] bg-red-50 border-red-200' }
}

export function CalendarioClient({ eventos, categorias }: { eventos: Evento[]; categorias: string[] }) {
  const [filtro, setFiltro] = useState<string>('Todos')

  const filtrados = filtro === 'Todos' ? eventos : eventos.filter((e) => e.categoria === filtro)

  // Agrupa por mês
  const porMes: Record<string, Evento[]> = {}
  for (const e of filtrados) {
    const key = getMesKey(e.dataInicio)
    if (!porMes[key]) porMes[key] = []
    porMes[key].push(e)
  }

  const meses = Object.keys(porMes).sort()

  return (
    <section className="py-12 bg-white">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        {/* Filtros de categoria */}
        <div className="flex flex-wrap gap-2 mb-10">
          {['Todos', ...categorias].map((cat) => (
            <button
              key={cat}
              onClick={() => setFiltro(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-150 ${
                filtro === cat
                  ? 'bg-[#d42b2b] border-[#d42b2b] text-white shadow-sm'
                  : 'bg-white border-[#e5e5e5] text-[#555] hover:border-[#d42b2b] hover:text-[#d42b2b]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <div className="text-center py-16 bg-[#fafafa] rounded-2xl border border-[#eee]">
            <Calendar size={36} className="text-[#ccc] mx-auto mb-3" />
            <p className="text-[#777] font-inter">Nenhum evento nesta categoria no momento.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {meses.map((mesKey) => {
              const mesEventos = porMes[mesKey]
              const mesLabel = getMes(mesEventos[0].dataInicio)
              return (
                <div key={mesKey}>
                  {/* Cabeçalho do mês */}
                  <div className="flex items-center gap-4 mb-6">
                    <h2 className="font-barlow font-black text-2xl md:text-3xl text-[#111] capitalize" style={{ letterSpacing: '-0.5px' }}>
                      {mesLabel}
                    </h2>
                    <div className="flex-1 h-px bg-[#eee]" />
                    <span className="text-sm text-[#999] font-inter">{mesEventos.length} {mesEventos.length === 1 ? 'evento' : 'eventos'}</span>
                  </div>

                  {/* Grid de eventos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {mesEventos.map((evento) => {
                      const { texto: precoTexto, cor: precoCor } = precoLabel(evento.preco)
                      return (
                        <Link
                          key={evento.id}
                          href={`/eventos/${evento.slug}`}
                          className="group flex flex-col bg-white border border-[#eee] hover:border-[#d42b2b]/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          {/* Imagem */}
                          <div className="relative h-44 bg-gradient-to-br from-[#1a1a2e] to-[#2a1a1a] overflow-hidden">
                            {evento.imagemUrl ? (
                              <img
                                src={evento.imagemUrl}
                                alt={evento.titulo}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Calendar size={36} className="text-white/20" />
                              </div>
                            )}
                            {/* Badge preço */}
                            <span className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full border ${precoCor}`}>
                              {precoTexto}
                            </span>
                            {/* Badge destaque */}
                            {evento.destaque && (
                              <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-400 text-yellow-900 uppercase tracking-wider">
                                Destaque
                              </span>
                            )}
                          </div>

                          {/* Conteúdo */}
                          <div className="flex flex-col flex-1 p-5">
                            {/* Categoria */}
                            <div className="flex items-center gap-1.5 text-xs text-[#d42b2b] font-semibold uppercase tracking-wider mb-2">
                              <Tag size={11} />
                              {evento.categoria}
                            </div>

                            <h3 className="font-barlow font-bold text-[#111] text-lg leading-tight mb-3 group-hover:text-[#d42b2b] transition-colors line-clamp-2">
                              {evento.titulo}
                            </h3>

                            <p className="text-[#666] text-sm font-inter leading-relaxed line-clamp-2 flex-1 mb-4">
                              {evento.descricao}
                            </p>

                            {/* Data e local */}
                            <div className="space-y-1.5 text-xs text-[#888] font-inter border-t border-[#f0f0f0] pt-3">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={12} className="text-[#d42b2b] shrink-0" />
                                <span>{formatData(evento.dataInicio)} · {formatHora(evento.dataInicio)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin size={12} className="text-[#d42b2b] shrink-0" />
                                <span className="truncate">{evento.local}</span>
                              </div>
                              {evento.vagas && (
                                <div className="flex items-center gap-1.5">
                                  <Users size={12} className="text-[#d42b2b] shrink-0" />
                                  <span>{evento.vagas} vagas</span>
                                </div>
                              )}
                            </div>

                            {/* CTA */}
                            <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-[#d42b2b] group-hover:gap-2 transition-all duration-150">
                              Ver detalhes <ChevronRight size={15} />
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
