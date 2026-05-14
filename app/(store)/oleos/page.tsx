export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { CategoryLanding } from '@/components/store/CategoryLanding'
import { SITE_URL } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'Óleo de Moto em Campinas — Mobil, Motul, Castrol e Yamalube',
  description:
    'Compre óleo para moto em Campinas/SP. Marcas Mobil, Motul, Castrol, Yamalube e mais. Mineral, semissintético ou sintético. Troca rápida na loja. (19) 97404-9445.',
  keywords: [
    'óleo moto Campinas',
    'óleo Mobil moto',
    'óleo Motul',
    'óleo Castrol moto',
    'óleo 10W30 moto',
    'óleo 10W40 moto',
    'óleo 20W50',
  ],
  alternates: { canonical: `${SITE_URL}/oleos` },
}

const FAQS = [
  {
    question: 'Qual a diferença entre óleo mineral, semissintético e sintético?',
    answer:
      'Mineral é o mais simples e barato, indicado para motos de baixa cilindrada e troca a cada 1.000-2.000 km. Semissintético é o equilíbrio entre custo e proteção, troca a cada 3.000-4.000 km. Sintético é o mais avançado, indicado para motos esportivas/alta cilindrada, com troca a cada 5.000-8.000 km.',
  },
  {
    question: 'Qual viscosidade usar na minha moto (10W30, 10W40, 20W50)?',
    answer:
      'A viscosidade indicada está no manual da moto. Em geral: 10W30 para motos modernas (climas frios também), 10W40 para uso geral em clima brasileiro, 20W50 para motos mais antigas ou de alta quilometragem. Em caso de dúvida, mande o modelo da sua moto pelo WhatsApp.',
  },
  {
    question: 'Quando trocar o óleo da moto?',
    answer:
      'Depende do tipo de óleo: mineral a cada 1.000-2.000 km, semissintético a cada 3.000-4.000 km, sintético a cada 5.000-8.000 km. Sempre troque também o filtro de óleo a cada 2 trocas, ou junto se preferir.',
  },
  {
    question: 'Vocês fazem a troca do óleo na hora?',
    answer:
      'Sim. Comprou o óleo conosco? Troca grátis na hora se for dentro do horário comercial. Para clientes que trazem o próprio óleo, cobramos R$ 30 pela mão de obra (inclui filtro novo e descarte ecológico do óleo usado).',
  },
  {
    question: 'O óleo vencido faz mal pra moto?',
    answer:
      'Óleo lacrado tem validade de cerca de 5 anos. Já o óleo na moto degrada com o tempo (mesmo sem rodar muito), perde aditivos e contamina. Recomendamos trocar a cada 6-12 meses mesmo que tenha rodado pouco.',
  },
]

export default function OleosPage() {
  return (
    <CategoryLanding
      slug="oleos"
      titulo="Óleos de Moto"
      subtitulo="Mobil, Motul, Castrol, Yamalube e Honda. Mineral, semissintético ou sintético para todas as cilindradas."
      termosBusca={['óleo', 'oleo', 'lubrificante']}
      heroFrom="#1a3a1a"
      heroTo="#0e2a0e"
      heroBgImage="/images/hero/hero-oleos.jpg"
      bullets={[
        { titulo: 'Marcas premium', desc: 'Mobil, Motul, Castrol, Yamalube e Honda.' },
        { titulo: 'Troca rápida', desc: 'Em 20 minutos com filtro novo incluso.' },
        { titulo: 'Descarte ecológico', desc: 'Coletamos e descartamos o óleo usado corretamente.' },
      ]}
      faqs={FAQS}
    />
  )
}
