export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { CalendarioClient } from '@/components/store/CalendarioClient'
import { SITE_URL } from '@/lib/schema'
import { Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Calendário de Eventos — Forza Motos Campinas',
  description:
    'Cursos, passeios, viagens e eventos para motociclistas em Campinas e região. Confira a agenda e garanta sua vaga na Forza Motos.',
  keywords: ['eventos motos Campinas', 'passeio moto', 'curso pilotagem', 'encontro motos', 'viagem moto'],
  alternates: { canonical: `${SITE_URL}/calendario` },
  openGraph: {
    title: 'Calendário de Eventos — Forza Motos',
    description: 'Cursos, passeios e viagens para motociclistas.',
    url: `${SITE_URL}/calendario`,
    type: 'website',
  },
}

export default async function CalendarioPage() {
  const eventos = await prisma.evento.findMany({
    where: { publicado: true, ativo: true },
    orderBy: { dataInicio: 'asc' },
  })

  const categorias = Array.from(new Set(eventos.map((e) => e.categoria))).sort()

  const serialized = eventos.map((e) => ({
    ...e,
    preco: Number(e.preco),
    dataInicio: e.dataInicio.toISOString(),
    dataFim: e.dataFim?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }))

  return (
    <>
      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb items={[{ name: 'Calendário de Eventos', url: '/calendario' }]} />
      </div>

      {/* Hero */}
      <section
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #2a1a1a 100%)', padding: '56px 0 48px' }}
        className="text-white"
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#d42b2b]/20 border border-[#d42b2b]/30 flex items-center justify-center">
              <Calendar size={24} className="text-[#d42b2b]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[2.5px] uppercase text-white/50 mb-1">Forza Motos</p>
              <h1 className="font-barlow font-black text-3xl md:text-5xl leading-tight" style={{ letterSpacing: '-1px' }}>
                Calendário de Eventos
              </h1>
            </div>
          </div>
          <p className="text-white/60 text-base md:text-lg font-inter max-w-xl mt-3">
            Cursos, passeios, viagens e encontros para quem vive de moto. Confira a agenda e garanta sua vaga.
          </p>
        </div>
      </section>

      {/* Conteúdo */}
      {eventos.length === 0 ? (
        <section className="py-20 text-center">
          <Calendar size={48} className="text-[#ccc] mx-auto mb-4 opacity-30" />
          <p className="text-[#666] font-inter mb-2 text-lg">Nenhum evento programado por enquanto.</p>
          <p className="text-[#999] font-inter text-sm mb-6">
            Fique de olho — novidades chegam em breve!
          </p>
          <a
            href="https://wa.me/5519974049445?text=Ol%C3%A1!%20Quero%20saber%20sobre%20os%20pr%C3%B3ximos%20eventos."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Avisar quando tiver eventos
          </a>
        </section>
      ) : (
        <CalendarioClient eventos={serialized} categorias={categorias} />
      )}
    </>
  )
}
