import { Phone, MapPin } from 'lucide-react'

export function AnnouncementBar() {
  return (
    <div
      style={{
        background: '#111',
        color: '#fff',
        fontSize: '12px',
        padding: '7px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '24px',
        flexWrap: 'wrap',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.2px',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        🏍️ <span style={{ color: '#d42b2b', fontWeight: 600 }}>Frete grátis</span> em compras acima de R$ 299
      </span>
      <span style={{ opacity: 0.4 }}>·</span>
      <a
        href="tel:+5519974049445"
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff', textDecoration: 'none' }}
      >
        <Phone size={12} /> (19) 97404-9445
      </a>
      <span style={{ opacity: 0.4 }} className="hidden md:inline">·</span>
      <span className="hidden md:flex" style={{ alignItems: 'center', gap: 6 }}>
        <MapPin size={12} /> Campinas/SP
      </span>
    </div>
  )
}
