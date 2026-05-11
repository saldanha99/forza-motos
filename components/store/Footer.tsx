import Link from 'next/link'
import { MapPin, Phone, MessageCircle, Clock } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Marca */}
          <div className="col-span-1 md:col-span-2">
            <span className="font-rajdhani font-bold text-2xl">
              <span className="text-white">FORZA</span>
              <span className="text-vermelho"> MOTOS</span>
            </span>
            <p className="mt-3 text-sm text-zinc-500 max-w-xs leading-relaxed">
              Credenciada oficial Pirelli, Metzeler e Michelin. Box rápido especializado em
              pneus, freios, óleo e transmissão desde 2015 em Campinas/SP.
            </p>
            <div className="mt-4 flex gap-3">
              {['Pirelli', 'Metzeler', 'Michelin'].map((marca) => (
                <span
                  key={marca}
                  className="px-3 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-400 font-medium"
                >
                  {marca}
                </span>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-rajdhani font-semibold text-white mb-3 uppercase tracking-wide">
              Navegação
            </h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              {[
                { href: '/produtos', label: 'Produtos' },
                { href: '/agendar', label: 'Agendar Serviço' },
                { href: '/rastrear', label: 'Rastrear Pedido' },
                { href: '/blog', label: 'Blog' },
                { href: '/login', label: 'Minha Conta' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="font-rajdhani font-semibold text-white mb-3 uppercase tracking-wide">
              Contato
            </h4>
            <ul className="space-y-3 text-sm text-zinc-500">
              <li className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 text-vermelho shrink-0" />
                <span>R. Funilense, 110 – Vila Nova, Campinas/SP – CEP 13073-041</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={15} className="text-vermelho shrink-0" />
                <a href="tel:+551932540547" className="hover:text-white transition-colors">
                  (19) 3254-0547
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle size={15} className="text-vermelho shrink-0" />
                <a
                  href="https://wa.me/5519974049445"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  (19) 97404-9445
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Clock size={15} className="mt-0.5 text-vermelho shrink-0" />
                <span>Seg–Sex: 8h–18h | Sáb: 8h–13h</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
          <p>© {new Date().getFullYear()} Forza Motos. Todos os direitos reservados.</p>
          <p>CNPJ: a confirmar · Campinas, SP</p>
        </div>
      </div>
    </footer>
  )
}
