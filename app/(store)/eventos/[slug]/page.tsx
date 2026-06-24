export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { SITE_URL } from '@/lib/schema'
import { Calendar, MapPin, Tag, Users, ArrowLeft, ExternalLink } from 'lucide-react'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const evento = await prisma.evento.findUnique({ where: { slug: params.slug } })
  if (!evento) return { title: 'Evento não encontrado' }

  return {
    title: `${evento.titulo} — Forza Motos`,
    description: evento.descricao.slice(0, 160),
    alternates: { canonical: `${SITE_URL}/eventos/${evento.slug}` },
    openGraph: {
      title: evento.titulo,
      description: evento.descricao.slice(0, 160),
      url: `${SITE_URL}/eventos/${evento.slug}`,
      images: evento.imagemUrl ? [{ url: evento.imagemUrl, alt: evento.titulo }] : [],
    },
  }
}

function formatDataCompleta(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d)
}

function precoLabel(preco: number) {
  if (preco === 0) return 'Gratuito'
  return `R$ ${preco.toFixed(2)}`
}

export default async function EventoDetailPage({ params }: Props) {
  const evento = await prisma.evento.findUnique({
    where: { slug: params.slug, publicado: true, ativo: true },
  })

  if (!evento) notFound()

  const preco = Number(evento.preco)

  // WhatsApp com texto pré-preenchido para inscrição
  const waMsg = encodeURIComponent(`Olá! Tenho interesse no evento "${evento.titulo}" (${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(evento.dataInicio)}). Gostaria de mais informações!`)
  const waUrl = `https://wa.me/5519974049445?text=${waMsg}`

  return (
    <>
      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb
          items={[
            { name: 'Calendário', url: '/calendario' },
            { name: evento.titulo, url: `/eventos/${evento.slug}` },
          ]}
        />
      </div>

      {/* Hero com imagem */}
      <section className="relative overflow-hidden" style={{ minHeight: 320 }}>
        {evento.imagemUrl ? (
          <>
            <img src={evento.imagemUrl} alt={evento.titulo} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #2a1a1a 100%)' }} />
        )}

        <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-12 py-12 text-white">
          <Link
            href="/calendario"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-5"
          >
            <ArrowLeft size={14} /> Voltar ao calendário
          </Link>

          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#d42b2b] mb-3">
            <Tag size={12} />
            {evento.categoria}
            {evento.destaque && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900 font-bold text-[10px]">Destaque</span>
            )}
          </div>

          <h1 className="font-barlow font-black text-3xl md:text-5xl leading-tight mb-5" style={{ letterSpacing: '-1px' }}>
            {evento.titulo}
          </h1>

          <p className="text-white/70 text-lg font-inter max-w-2xl">{evento.descricao}</p>
        </div>
      </section>

      {/* Conteúdo */}
      <section className="py-12 bg-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid lg:grid-cols-[1fr_360px] gap-10">
          {/* Coluna principal */}
          <div>
            {evento.conteudo ? (
              <div
                className="prose prose-gray max-w-none text-[#333] font-inter"
                dangerouslySetInnerHTML={{ __html: evento.conteudo }}
              />
            ) : (
              <p className="text-[#666] font-inter italic">Mais detalhes em breve.</p>
            )}
          </div>

          {/* Sidebar sticky */}
          <div className="space-y-5 lg:sticky lg:top-24 self-start">
            {/* Card de inscrição */}
            <div className="border border-[#eee] rounded-2xl p-6 shadow-sm bg-white">
              {/* Preço */}
              <div className="mb-5">
                {preco === 0 ? (
                  <div>
                    <span className="text-3xl font-barlow font-black text-emerald-600">Gratuito</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl font-barlow font-black text-[#d42b2b]">R$ {preco.toFixed(2)}</span>
                    <span className="text-sm text-[#999] font-inter ml-2">por pessoa</span>
                  </div>
                )}
              </div>

              {/* Detalhes */}
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2.5 text-sm text-[#555] font-inter">
                  <Calendar size={15} className="text-[#d42b2b] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#333] capitalize">{formatDataCompleta(evento.dataInicio)}</p>
                    {evento.dataFim && (
                      <p className="text-xs text-[#888] mt-0.5">até {formatDataCompleta(evento.dataFim)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-sm text-[#555] font-inter">
                  <MapPin size={15} className="text-[#d42b2b] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#333]">{evento.local}</p>
                    {evento.endereco && <p className="text-xs text-[#888] mt-0.5">{evento.endereco}</p>}
                  </div>
                </div>
                {evento.vagas && (
                  <div className="flex items-center gap-2.5 text-sm text-[#555] font-inter">
                    <Users size={15} className="text-[#d42b2b] shrink-0" />
                    <span><strong className="text-[#333]">{evento.vagas}</strong> vagas disponíveis</span>
                  </div>
                )}
              </div>

              {/* Botões de ação */}
              <div className="space-y-3">
                {evento.linkExterno ? (
                  <a
                    href={evento.linkExterno}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase text-sm tracking-wider px-6 py-4 rounded-xl transition-colors"
                  >
                    <ExternalLink size={16} />
                    {preco === 0 ? 'Inscrever-se' : 'Comprar ingresso'}
                  </a>
                ) : (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase text-sm tracking-wider px-6 py-4 rounded-xl transition-colors"
                  >
                    {preco === 0 ? 'Quero participar' : 'Comprar via WhatsApp'}
                  </a>
                )}
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full border border-green-500 text-green-600 hover:bg-green-50 font-semibold text-sm px-6 py-3.5 rounded-xl transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.113.549 4.093 1.513 5.817L0 24l6.335-1.483A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.51-5.17-1.402l-.371-.22-3.755.879.938-3.66-.242-.374A9.933 9.933 0 0 1 2 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z" />
                  </svg>
                  Tirar dúvidas no WhatsApp
                </a>
              </div>
            </div>

            {/* Outros eventos */}
            <div className="text-center">
              <Link href="/calendario" className="text-sm text-[#d42b2b] hover:underline font-semibold">
                ← Ver todos os eventos
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
