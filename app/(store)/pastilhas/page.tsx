export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { CategoryLanding } from '@/components/store/CategoryLanding'
import { SITE_URL } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'Pastilhas de Freio para Moto em Campinas — Cerâmica, Sinterizada',
  description:
    'Compre pastilhas de freio para moto em Campinas/SP. Cerâmica, sinterizada e orgânica. Marcas Cobreq, Fras-le, EBC, SBS. Instalação inclusa na loja. (19) 97404-9445.',
  keywords: [
    'pastilha freio moto Campinas',
    'pastilha freio Cobreq',
    'pastilha freio EBC',
    'pastilha sinterizada moto',
    'troca pastilha moto',
  ],
  alternates: { canonical: `${SITE_URL}/pastilhas` },
}

const FAQS = [
  {
    question: 'Quando trocar a pastilha de freio da moto?',
    answer:
      'Os principais sinais são: barulho de metal raspando ao frear, distância de frenagem maior, vibração no manete, pastilha com espessura abaixo de 2mm. Em uso normal, a pastilha dianteira dura entre 15.000 e 25.000 km e a traseira entre 20.000 e 30.000 km.',
  },
  {
    question: 'Pastilha cerâmica ou sinterizada, qual a diferença?',
    answer:
      'Orgânica (cerâmica) é mais silenciosa, agride menos o disco, ideal para uso urbano e iniciantes. Sinterizada (metálica) tem maior poder de frenagem, suporta altas temperaturas, ideal para uso esportivo, viagens longas ou motos pesadas — porém é mais barulhenta e desgasta mais o disco.',
  },
  {
    question: 'Quanto custa a troca de pastilha na Forza Motos?',
    answer:
      'O preço da pastilha varia conforme a marca e modelo (a partir de R$ 35 o par). A mão de obra para troca custa R$ 60 (dianteira + traseira), incluindo limpeza dos pinos e verificação do fluido de freio.',
  },
  {
    question: 'Preciso trocar o disco junto com a pastilha?',
    answer:
      'Nem sempre. O disco precisa ser trocado se estiver com espessura mínima (gravada no próprio disco), empenado, riscado profundamente ou com trincas. Se o disco está em boas condições, basta trocar só a pastilha.',
  },
  {
    question: 'O par de pastilhas (dianteira + traseira) vem junto?',
    answer:
      'Não. Pastilha dianteira e traseira são vendidas separadamente porque têm formatos diferentes e a dianteira costuma ser mais robusta. Geralmente as duas são trocadas juntas, mas o par é só para um dos lados.',
  },
]

export default function PastilhasPage() {
  return (
    <CategoryLanding
      slug="pastilhas"
      titulo="Pastilhas de Freio para Moto"
      subtitulo="Cerâmica, sinterizada ou orgânica. Cobreq, Fras-le, EBC e SBS. Instalação inclusa na loja."
      termosBusca={['pastilha', 'freio']}
      heroFrom="#3a1a1a"
      heroTo="#2a0e0e"
      bullets={[
        { titulo: 'Marcas confiáveis', desc: 'Cobreq, Fras-le, EBC e SBS.' },
        { titulo: 'Instalação inclusa', desc: 'Trocamos na loja em 40 minutos.' },
        { titulo: 'Verificação completa', desc: 'Limpamos pinos e verificamos fluido.' },
      ]}
      faqs={FAQS}
    />
  )
}
