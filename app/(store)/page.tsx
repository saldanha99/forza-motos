import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { ArrowRight, Zap, Shield, Award, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'

async function getProdutosDestaque() {
  try {
    return await prisma.product.findMany({
      where: { destaque: true, ativo: true },
      take: 8,
      orderBy: { createdAt: 'desc' },
    })
  } catch {
    return []
  }
}

export default async function HomePage() {
  const produtos = await getProdutosDestaque()

  const categorias = [
    { nome: 'Pneus', emoji: '🛞', href: '/produtos?categoria=pneus', desc: 'Pirelli, Metzeler, Michelin' },
    { nome: 'Óleos', emoji: '🛢️', href: '/produtos?categoria=oleos', desc: 'Troca rápida e completa' },
    { nome: 'Transmissão', emoji: '⚙️', href: '/produtos?categoria=transmissao', desc: 'Kits completos de corrente' },
    { nome: 'Freios', emoji: '🔧', href: '/produtos?categoria=freios', desc: 'Pastilhas e discos' },
  ]

  const diferenciais = [
    { icon: Zap, titulo: 'Box Rápido', desc: 'Troca de pneu em até 30 minutos, sem agendamento' },
    { icon: Award, titulo: 'Credenciada Oficial', desc: 'Pirelli, Metzeler e Michelin' },
    { icon: Shield, titulo: 'Garantia Total', desc: 'Peças e mão de obra garantidas' },
    { icon: Clock, titulo: 'Desde 2015', desc: 'Mais de 10 anos atendendo motociclistas' },
  ]

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-zinc-950 via-[#0a0a0a] to-zinc-900">
        <div className="absolute inset-0 bg-gradient-radial from-vermelho/5 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-vermelho/10 border border-vermelho/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-vermelho rounded-full animate-pulse" />
              <span className="text-xs text-vermelho font-medium uppercase tracking-wider">
                Credenciada Pirelli · Metzeler · Michelin
              </span>
            </div>
            <h1 className="font-rajdhani font-bold text-5xl md:text-7xl leading-tight text-white mb-6">
              SEU PNEU
              <br />
              <span className="text-vermelho">TROCADO</span>
              <br />
              EM 30MIN
            </h1>
            <p className="text-zinc-400 text-lg mb-10 leading-relaxed">
              Box rápido em Campinas/SP. Pneus, freios, óleo e kit de transmissão com os melhores
              produtos do mercado.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/produtos">
                <Button size="lg" className="w-full sm:w-auto">
                  Ver Pneus <ArrowRight size={18} />
                </Button>
              </Link>
              <Link href="/agendar">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Agendar Serviço
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categorias */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="font-rajdhani font-bold text-3xl text-white mb-8 uppercase tracking-wide">
          Categorias
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categorias.map((cat) => (
            <Link key={cat.nome} href={cat.href}>
              <div className="bg-zinc-900 border border-zinc-800 hover:border-vermelho/50 rounded-lg p-6 transition-all duration-200 group cursor-pointer">
                <span className="text-4xl mb-3 block">{cat.emoji}</span>
                <h3 className="font-rajdhani font-bold text-lg text-white group-hover:text-vermelho transition-colors">
                  {cat.nome}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">{cat.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Produtos em Destaque */}
      {produtos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-rajdhani font-bold text-3xl text-white uppercase tracking-wide">
              Em Destaque
            </h2>
            <Link href="/produtos" className="text-sm text-vermelho hover:text-red-400 flex items-center gap-1">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {produtos.map((p) => (
              <ProductCard key={p.id} produto={p} />
            ))}
          </div>
        </section>
      )}

      {/* Marcas Credenciadas */}
      <section className="border-y border-zinc-800 bg-zinc-950/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-zinc-600 uppercase tracking-widest mb-8">
            Credenciada Oficial
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            {['PIRELLI', 'METZELER', 'MICHELIN'].map((marca) => (
              <span key={marca} className="font-rajdhani font-bold text-2xl text-zinc-600 hover:text-zinc-400 transition-colors">
                {marca}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="font-rajdhani font-bold text-3xl text-white mb-10 uppercase tracking-wide text-center">
          Por que a Forza Motos?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {diferenciais.map((d) => (
            <div key={d.titulo} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-vermelho/10 border border-vermelho/20 rounded-lg mb-4">
                <d.icon size={22} className="text-vermelho" />
              </div>
              <h3 className="font-rajdhani font-semibold text-lg text-white mb-2">{d.titulo}</h3>
              <p className="text-sm text-zinc-500">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Agendamento */}
      <section className="bg-vermelho/5 border-y border-vermelho/10 py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-rajdhani font-bold text-4xl text-white mb-4 uppercase">
            Agende seu serviço
          </h2>
          <p className="text-zinc-400 mb-8">
            Escolha o dia e horário que preferir. Confirmação via WhatsApp na hora.
          </p>
          <Link href="/agendar">
            <Button size="lg">
              Agendar Agora <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </section>
    </>
  )
}
