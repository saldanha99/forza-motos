import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { ReviewsSection } from '@/components/store/ReviewsSection'
import {
  SITE_URL,
  SITE_PHONE,
  SITE_WHATSAPP,
  ADDRESS,
  getLocalBusinessSchema,
} from '@/lib/schema'
import {
  MapPin,
  Phone,
  Clock,
  Mail,
  Award,
  Users,
  Wrench,
  CheckCircle2,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sobre a Forza Motos — Especialistas em Duas Rodas em Campinas',
  description:
    'Conheça a Forza Motos, loja e oficina especializada em motos em Campinas/SP. Credenciada Pirelli, Metzeler e Michelin. Mais de 2.800 produtos e box rápido para serviços.',
  alternates: { canonical: `${SITE_URL}/sobre` },
  openGraph: {
    title: 'Sobre a Forza Motos',
    description: 'Loja e oficina especializada em motos em Campinas/SP desde sua fundação.',
    url: `${SITE_URL}/sobre`,
  },
}

const SCHEMA = getLocalBusinessSchema()

const MARCAS_PARCEIRAS = [
  'Pirelli',
  'Metzeler',
  'Michelin',
  'Bridgestone',
  'Rinaldi',
  'Mobil',
  'Motul',
  'Castrol',
  'Cobreq',
  'EBC',
]

export default function SobrePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb items={[{ name: 'Sobre', url: '/sobre' }]} />
      </div>

      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #2a2a44 100%)',
          color: '#fff',
          padding: '80px 0 64px',
        }}
      >
        <div className="max-w-3xl mx-auto px-6 md:px-12 text-center">
          <p className="text-[#d42b2b] font-barlow font-bold uppercase tracking-[3px] text-sm mb-3">
            Forza Motos
          </p>
          <h1
            className="font-barlow font-black text-4xl md:text-5xl lg:text-6xl leading-[1.05] mb-5"
            style={{ letterSpacing: '-1px' }}
          >
            Especialistas em duas rodas em Campinas
          </h1>
          <p className="text-white/80 text-lg font-inter leading-relaxed">
            Loja e oficina especializada em motos. Credenciada pelas maiores marcas do mundo, com box rápido e estoque para atender desde a moto urbana até a esportiva mais exigente.
          </p>
        </div>
      </section>

      {/* Números */}
      <section className="py-12 bg-white border-b border-[#eee]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { num: '2.800+', label: 'Produtos em estoque', icon: Wrench },
            { num: '4.9★', label: 'Avaliação dos clientes', icon: Award },
            { num: '30 min', label: 'Box rápido', icon: Clock },
            { num: '5.000+', label: 'Motos atendidas', icon: Users },
          ].map((s, i) => (
            <div key={i} className="p-4">
              <s.icon className="mx-auto mb-3 text-[#d42b2b]" size={28} />
              <p className="font-barlow font-black text-3xl md:text-4xl text-[#111] mb-1" style={{ letterSpacing: '-0.5px' }}>
                {s.num}
              </p>
              <p className="text-[#666] font-inter text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* História */}
      <section className="py-16 bg-[#fafafa]">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] mb-6" style={{ letterSpacing: '-0.5px' }}>
            Nossa história
          </h2>
          <div className="space-y-4 text-[#444] font-inter leading-relaxed">
            <p>
              A <strong>Forza Motos</strong> nasceu da paixão por motos. Começamos como uma pequena oficina em Campinas e, com o tempo, nos tornamos referência regional em pneus, óleos, peças e serviços para motociclistas.
            </p>
            <p>
              Hoje somos credenciados pelas principais marcas do mercado — <strong>Pirelli, Metzeler, Michelin, Bridgestone</strong> — e oferecemos um catálogo com mais de 2.800 produtos, atendendo desde a moto do entregador até a esportiva de alta cilindrada.
            </p>
            <p>
              Nosso diferencial: <strong>box rápido sem agendamento</strong>. Troca de pneu em 30 minutos, óleo em 20 minutos. Atendimento técnico de verdade, sem firula. Você chega, escolhe, instala e sai rodando.
            </p>
          </div>
        </div>
      </section>

      {/* Marcas parceiras */}
      <section className="py-14 bg-white border-t border-[#eee]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-2xl md:text-3xl text-[#111] text-center mb-2" style={{ letterSpacing: '-0.5px' }}>
            Marcas parceiras
          </h2>
          <p className="text-center text-[#666] font-inter mb-8">
            Trabalhamos com as melhores marcas do mundo
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {MARCAS_PARCEIRAS.map((m) => (
              <span key={m} className="font-barlow font-black text-xl md:text-2xl text-[#444] tracking-[2px]">
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="py-14 bg-[#fafafa] border-t border-[#eee]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] text-center mb-10" style={{ letterSpacing: '-0.5px' }}>
            Por que escolher a Forza Motos?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { titulo: 'Credenciada oficial', desc: 'Distribuidor autorizado Pirelli, Metzeler e Michelin.' },
              { titulo: 'Box rápido', desc: 'Troca de pneu em 30 min sem agendamento.' },
              { titulo: 'Mecânicos especializados', desc: 'Equipe treinada em motos de todas as marcas.' },
              { titulo: 'Garantia em tudo', desc: '60 dias na mão de obra. Garantia oficial nas peças.' },
            ].map((d, i) => (
              <div key={i} className="bg-white rounded-lg p-5 border border-[#eee]">
                <CheckCircle2 className="text-[#d42b2b] mb-3" size={22} />
                <h3 className="font-barlow font-bold text-lg text-[#111] mb-1.5">{d.titulo}</h3>
                <p className="text-[#666] font-inter text-sm leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Localização + Contato */}
      <section className="py-14 bg-white border-t border-[#eee]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] mb-5" style={{ letterSpacing: '-0.5px' }}>
              Visite nossa loja
            </h2>
            <div className="space-y-4 font-inter text-[#444]">
              <div className="flex items-start gap-3">
                <MapPin className="text-[#d42b2b] shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="font-semibold">{ADDRESS.streetAddress}</p>
                  <p className="text-sm text-[#666]">
                    {ADDRESS.addressLocality} — {ADDRESS.addressRegion} · CEP {ADDRESS.postalCode}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="text-[#d42b2b]" size={18} />
                <a href={`tel:${SITE_PHONE.replace(/\D/g, '')}`} className="hover:text-[#d42b2b] transition-colors">
                  {SITE_PHONE.replace(/\+55-/, '').replace(/-/g, ' ')}
                </a>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="text-[#d42b2b] shrink-0 mt-0.5" size={18} />
                <div className="text-sm">
                  <p>Segunda a sexta: <strong>8h às 18h</strong></p>
                  <p>Sábados: <strong>8h às 13h</strong></p>
                  <p className="text-[#888] mt-1">Domingos e feriados: fechado</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <a
                href={`https://wa.me/${SITE_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 hover:bg-green-600 text-white font-barlow font-bold uppercase px-5 py-2.5 rounded text-xs tracking-wider"
              >
                Falar no WhatsApp
              </a>
              <Link
                href="/agendar"
                className="border border-[#d42b2b] text-[#d42b2b] hover:bg-[#d42b2b] hover:text-white font-barlow font-bold uppercase px-5 py-2.5 rounded text-xs tracking-wider transition-colors"
              >
                Agendar serviço
              </Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden border border-[#eee]">
            <iframe
              src="https://www.google.com/maps/embed/v1/place?key=AIzaSyB&q=R.+Funilense,+110+Campinas+SP"
              style={{ border: 0, width: '100%', height: '100%' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localização Forza Motos"
            />
          </div>
        </div>
      </section>

      <ReviewsSection />
    </>
  )
}
