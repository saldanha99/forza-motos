import Link from 'next/link'

const COLS = [
  {
    title: 'Institucional',
    links: [
      { label: 'Sobre a Forza Motos', href: '#' },
      { label: 'Blog e Novidades', href: '/blog' },
      { label: 'Trabalhe Conosco', href: '#' },
      { label: 'Política de Privacidade', href: '#' },
      { label: 'Termos de Uso', href: '#' },
    ],
  },
  {
    title: 'Informações',
    links: [
      { label: 'Centro de Ajuda', href: '#' },
      { label: 'Métodos de Pagamento', href: '#' },
      { label: 'Como Comprar', href: '#' },
      { label: 'Programa de Fidelidade', href: '#' },
    ],
  },
  {
    title: 'Pedidos e Entregas',
    links: [
      { label: 'Rastrear Pedido', href: '/rastrear' },
      { label: 'Devoluções e Trocas', href: '#' },
      { label: 'Prazos de Entrega', href: '#' },
      { label: 'Frete Grátis', href: '#' },
    ],
  },
  {
    title: 'Compras',
    links: [
      { label: 'Catálogo de Produtos', href: '/produtos' },
      { label: 'Marcas Parceiras', href: '#' },
      { label: 'Lançamentos', href: '/produtos' },
      { label: 'Ofertas Exclusivas', href: '/produtos' },
    ],
  },
]

export function Footer() {
  return (
    <footer style={{ background: '#111', color: '#aaa', fontFamily: 'var(--font-inter), Inter, sans-serif' }}>

      {/* Main grid */}
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 pt-[52px] pb-10 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr] gap-10">

        {/* Brand column */}
        <div>
          <div className="bg-white rounded-[5px] px-3 py-[6px] inline-flex mb-5">
            <span className="font-barlow font-black text-xl text-[#111] tracking-wide leading-none">
              FORZA<span className="text-[#d42b2b]">MOTOS</span>
            </span>
          </div>

          <p className="text-[13px] text-[#777] leading-[1.7] mb-4">
            Especialistas em pneus e acessórios para motos. Credenciada Pirelli, Metzeler e Michelin desde 2015.
          </p>

          <div className="flex items-start gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" className="shrink-0 mt-0.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="text-[12.5px] text-[#777] leading-[1.5]">
              R. Funilense, 110 – Vila Nova<br />Campinas – SP · CEP 13073-041
            </span>
          </div>

          <div className="flex items-center gap-2 mb-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.5 10.82a19.79 19.79 0 01-3.07-8.67A2 2 0 012.4 0h3a2 2 0 012 1.72c.13 1 .37 1.97.72 2.91a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006 6l1.17-1.17a2 2 0 012.11-.45c.94.35 1.91.59 2.91.72A2 2 0 0122 16.92z"/>
            </svg>
            <a href="tel:+551932540547" className="text-[12.5px] text-[#777] hover:text-[#d42b2b] transition-colors">
              (19) 3254-0547
            </a>
          </div>

          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
            </svg>
            <a href="https://wa.me/5519974049445" target="_blank" rel="noopener noreferrer"
              className="text-[12.5px] text-[#777] hover:text-[#d42b2b] transition-colors">
              (19) 97404-9445
            </a>
          </div>

          {/* Social */}
          <div className="flex gap-2.5 mt-5">
            {[
              { label: 'Instagram', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg> },
              { label: 'WhatsApp', href: 'https://wa.me/5519974049445', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg> },
              { label: 'Facebook', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg> },
            ].map(({ label, href, icon }) => (
              <a
                key={label}
                href={href ?? '#'}
                title={label}
                target={href ? '_blank' : undefined}
                rel={href ? 'noopener noreferrer' : undefined}
                className="text-[#666] hover:text-[#d42b2b] flex items-center justify-center w-9 h-9 rounded-full border border-[#2a2a2a] hover:border-[#d42b2b] transition-all"
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="font-barlow font-bold text-[15px] text-white mb-4 uppercase tracking-[0.5px]">
              {col.title}
            </h4>
            <ul className="flex flex-col gap-[9px]">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-[#777] hover:text-[#d42b2b] transition-colors font-inter"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-[#222]" />

      {/* Bottom bar */}
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-[18px] flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
        <span className="text-[12px] text-[#555] font-inter">
          © {new Date().getFullYear()} Forza Motos – Todos os direitos reservados · CNPJ 00.000.000/0001-00
        </span>
        <div className="flex gap-3 items-center flex-wrap justify-center">
          {['Visa', 'Master', 'Pix', 'Boleto'].map((pay) => (
            <span
              key={pay}
              className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-[4px] px-2.5 py-1 text-[11px] font-inter text-[#666] font-medium"
            >
              {pay}
            </span>
          ))}
        </div>
      </div>
    </footer>
  )
}
