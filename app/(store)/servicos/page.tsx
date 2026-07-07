import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { FAQSection } from '@/components/store/FAQSection'
import {
  SITE_URL,
  SITE_PHONE,
  SITE_WHATSAPP,
  ADDRESS,
  getServiceSchema,
} from '@/lib/schema'
import {
  Wrench,
  Droplet,
  Disc,
  Settings,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  Calendar,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Oficina de Motos em Campinas — Troca de Pneu, Óleo e Revisão',
  description:
    'Oficina especializada em motos em Campinas/SP. Troca de pneu (instalação inclusa), óleo, pastilhas, revisão e manutenção. Box rápido com agendamento online. (19) 97404-9445.',
  keywords: [
    'oficina motos Campinas',
    'mecânica de motos',
    'box rápido moto',
    'troca de óleo moto Campinas',
    'revisão moto Campinas',
  ],
  alternates: { canonical: `${SITE_URL}/servicos` },
  openGraph: {
    title: 'Oficina de Motos em Campinas — Forza Motos',
    description: 'Box rápido para motos. Troca de pneu, óleo, freios e revisão completa.',
    url: `${SITE_URL}/servicos`,
  },
}

const SERVICOS = [
  {
    icon: Disc,
    nome: 'Troca de Pneu',
    descricao: 'Instalação, montagem e balanceamento em 30 min. Pneu novo com garantia.',
    preco: 'A partir de R$ 30 (mão de obra)',
    tempo: '30 min',
    slug: 'troca-pneu-moto',
  },
  {
    icon: Droplet,
    nome: 'Troca de Óleo',
    descricao: 'Óleo Mobil, Motul ou Castrol. Filtro original incluso. Descarte ecológico.',
    preco: 'A partir de R$ 80 (com óleo)',
    tempo: '20 min',
    slug: 'troca-oleo-moto',
  },
  {
    icon: Disc,
    nome: 'Pastilhas de Freio',
    descricao: 'Troca de pastilha dianteira e traseira. Sangria do fluido se necessário.',
    preco: 'A partir de R$ 60 (mão de obra)',
    tempo: '40 min',
    slug: 'pastilhas-freio-moto',
  },
  {
    icon: Settings,
    nome: 'Revisão Completa',
    descricao: 'Checklist 30 pontos. Verificação de óleo, freio, corrente, suspensão.',
    preco: 'A partir de R$ 150',
    tempo: '1h30',
    slug: 'revisao-moto',
  },
  {
    icon: Wrench,
    nome: 'Manutenção Preventiva',
    descricao: 'Pacote completo: óleo + filtro + verificação geral. Para rodar tranquilo.',
    preco: 'A partir de R$ 250',
    tempo: '2h',
    slug: 'manutencao-preventiva-moto',
  },
  {
    icon: Settings,
    nome: 'Corrente e Coroa',
    descricao: 'Lubrificação, ajuste de tensão ou troca completa do kit relação.',
    preco: 'A partir de R$ 90 (mão de obra)',
    tempo: '50 min',
    slug: 'corrente-coroa-moto',
  },
]

const FAQS = [
  {
    question: 'Precisa marcar horário para troca de pneu ou óleo?',
    answer:
      'Sim. Trabalhamos com agendamento para garantir seu atendimento sem espera. Agende pelo WhatsApp (19) 97404-9445 e escolha o melhor horário — assim seu serviço já sai na hora marcada.',
  },
  {
    question: 'Quanto tempo leva uma troca de pneu?',
    answer:
      'Em média 30 minutos por pneu, incluindo desmontagem, instalação, balanceamento e calibragem. Se vier com a moto pronta (sem precisar abrir tanque ou bagageiro), pode ser ainda mais rápido.',
  },
  {
    question: 'Vocês fazem revisão de motos importadas (BMW, Ducati, Triumph)?',
    answer:
      'Sim, atendemos motos de todas as marcas. Para motos importadas com computador de bordo, fazemos diagnóstico via OBD e reset de luzes de revisão.',
  },
  {
    question: 'O serviço tem garantia?',
    answer:
      'Sim. Toda mão de obra tem garantia de 90 dias e as peças seguem a garantia do fabricante. Em caso de problema relacionado ao serviço, basta voltar à loja com a nota fiscal.',
  },
  {
    question: 'Qual o horário de funcionamento?',
    answer:
      'Segunda a sexta das 8h às 18h, sábados das 8h às 13h. Fechamos aos domingos e feriados nacionais. Em caso de emergência, contate via WhatsApp.',
  },
  {
    question: 'Vocês buscam a moto em casa?',
    answer:
      'Para serviços maiores e dentro de Campinas, podemos enviar um técnico para fazer o transporte. Entre em contato pelo WhatsApp para combinarmos.',
  },
]

const SERVICOS_SCHEMA = SERVICOS.map((s) =>
  getServiceSchema({
    nome: s.nome,
    descricao: s.descricao,
    preco: s.preco.match(/\d+/)?.[0],
    url: `${SITE_URL}/servicos#${s.slug}`,
  })
)

export default function ServicosPage() {
  return (
    <>
      {SERVICOS_SCHEMA.map((schema, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb items={[{ name: 'Serviços', url: '/servicos' }]} />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ color: '#fff', padding: '64px 0 56px' }}>
        <Image src="/images/hero/hero-servicos.jpg" alt="" fill sizes="100vw" className="object-cover object-center" priority />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(180,20,20,0.9) 0%, rgba(100,10,10,0.85) 100%)' }} />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-12">
          <h1
            className="font-barlow font-black text-4xl md:text-5xl lg:text-6xl leading-[1.05] mb-4 max-w-3xl"
            style={{ letterSpacing: '-1px' }}
          >
            Oficina de Motos em Campinas
          </h1>
          <p className="text-white/90 text-lg md:text-xl font-inter leading-relaxed mb-6 max-w-2xl">
            Box rápido para motos. Troca de pneu, óleo, pastilhas, revisão e manutenção preventiva. Mecânicos especializados, equipamentos de fábrica.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/agendar"
              className="bg-white hover:bg-[#f5f5f5] text-[#d42b2b] font-barlow font-bold uppercase px-7 py-3 rounded text-sm tracking-wider transition-colors"
            >
              <Calendar size={16} className="inline mr-1.5 -mt-0.5" />
              Agendar serviço
            </Link>
            <a
              href={`https://wa.me/${SITE_WHATSAPP}?text=Ol%C3%A1!%20Preciso%20de%20um%20servi%C3%A7o%20na%20minha%20moto.`}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/40 hover:border-white text-white font-barlow font-bold uppercase px-7 py-3 rounded text-sm tracking-wider transition-colors"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Cards de serviços */}
      <section className="py-14 bg-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2
            className="font-barlow font-bold text-3xl md:text-4xl text-[#111] text-center mb-2"
            style={{ letterSpacing: '-0.5px' }}
          >
            Serviços disponíveis
          </h2>
          <p className="text-center text-[#666] font-inter mb-10">
            Tudo o que sua moto precisa em um só lugar
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICOS.map((s) => (
              <div
                key={s.slug}
                id={s.slug}
                className="group p-6 bg-[#fafafa] hover:bg-white border border-[#eee] hover:border-[#d42b2b] rounded-lg transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 flex items-center justify-center rounded-full bg-[#d42b2b]/10 text-[#d42b2b] group-hover:bg-[#d42b2b] group-hover:text-white transition-colors shrink-0">
                    <s.icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-barlow font-bold text-xl text-[#111] leading-tight">{s.nome}</h3>
                    <span className="text-xs text-[#888] font-inter flex items-center gap-1 mt-0.5">
                      <Clock size={11} /> {s.tempo}
                    </span>
                  </div>
                </div>
                <p className="text-[#555] font-inter text-sm leading-relaxed mb-3">
                  {s.descricao}
                </p>
                <p className="text-sm font-barlow font-bold text-[#d42b2b] mb-4">
                  {s.preco}
                </p>
                <Link
                  href="/agendar"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#111] hover:text-[#d42b2b] uppercase tracking-wider transition-colors"
                >
                  Agendar agora →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-14 bg-[#fafafa] border-t border-[#eee]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] text-center mb-2" style={{ letterSpacing: '-0.5px' }}>
            Como funciona o agendamento
          </h2>
          <p className="text-center text-[#666] font-inter mb-10">
            Em 3 passos simples
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { num: '1', titulo: 'Escolha o serviço', desc: 'Selecione qual serviço sua moto precisa.' },
              { num: '2', titulo: 'Data e horário', desc: 'Escolha o melhor dia para você.' },
              { num: '3', titulo: 'Confirme pelo WhatsApp', desc: 'Recebemos seu pedido e confirmamos o atendimento.' },
            ].map((p) => (
              <div key={p.num} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#d42b2b] text-white font-barlow font-black text-2xl mb-4">
                  {p.num}
                </div>
                <h3 className="font-barlow font-bold text-lg text-[#111] mb-2">{p.titulo}</h3>
                <p className="text-[#666] font-inter text-sm">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Localização */}
      <section className="py-14 bg-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] mb-4" style={{ letterSpacing: '-0.5px' }}>
                Onde nos encontrar
              </h2>
              <div className="space-y-3 font-inter text-[#444]">
                <div className="flex items-start gap-3">
                  <MapPin className="text-[#d42b2b] shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="font-medium">{ADDRESS.streetAddress}</p>
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
                <div className="flex items-center gap-3">
                  <Clock className="text-[#d42b2b]" size={18} />
                  <div className="text-sm">
                    <p>Segunda a sexta: <strong>8h às 18h</strong></p>
                    <p>Sábados: <strong>8h às 13h</strong></p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-6">
                <a
                  href="https://maps.google.com/?q=R.+Funilense,+110+Campinas+SP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase px-5 py-2.5 rounded text-xs tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <MapPin size={14} /> Como chegar
                </a>
                <a
                  href={`tel:${SITE_PHONE.replace(/\D/g, '')}`}
                  className="border border-[#d42b2b] text-[#d42b2b] hover:bg-[#d42b2b] hover:text-white font-barlow font-bold uppercase px-5 py-2.5 rounded text-xs tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <Phone size={14} /> Ligar agora
                </a>
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
        </div>
      </section>

      {/* FAQ */}
      <FAQSection title="Perguntas frequentes sobre nossos serviços" items={FAQS} />

      {/* CTA final */}
      <section className="py-12 bg-[#111] text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-barlow font-bold text-2xl md:text-3xl mb-3">
            Pronto para cuidar da sua moto?
          </h2>
          <p className="text-white/70 font-inter mb-6">
            Agende um horário ou apareça na loja. Box rápido sem espera.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/agendar"
              className="bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase px-7 py-3 rounded text-sm tracking-wider transition-colors"
            >
              Agendar serviço
            </Link>
            <a
              href={`https://wa.me/${SITE_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white font-barlow font-bold uppercase px-7 py-3 rounded text-sm tracking-wider transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} /> WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
