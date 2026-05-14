interface LogoSVGProps {
  /** true = texto "FORZA" branco (para fundos escuros); false = preto (fundos claros) */
  dark?: boolean
  height?: number
  className?: string
}

export function LogoSVG({ dark = false, height = 40, className = '' }: LogoSVGProps) {
  const textColor = dark ? '#ffffff' : '#111111'
  const width = Math.round(height * (168 / 50))

  return (
    <svg
      viewBox="0 0 168 50"
      height={height}
      width={width}
      fill="none"
      className={className}
      aria-label="Forza Motos"
      role="img"
    >
      {/* ── Oval badge ── */}
      <ellipse cx="25" cy="25" rx="23" ry="23" fill="#d42b2b" />
      <ellipse cx="25" cy="25" rx="19.5" ry="19.5" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />

      {/* ── FM initials ── */}
      <text
        x="25"
        y="32"
        textAnchor="middle"
        fill="white"
        fontSize="17"
        fontWeight="900"
        letterSpacing="-0.5"
        style={{ fontFamily: "var(--font-barlow),'Barlow Condensed',sans-serif" }}
      >
        FM
      </text>

      {/* ── Vertical divider ── */}
      <line x1="57" y1="9" x2="57" y2="41" stroke={dark ? 'rgba(255,255,255,0.18)' : '#ddd'} strokeWidth="1" />

      {/* ── FORZA ── */}
      <text
        x="66"
        y="26"
        fill={textColor}
        fontSize="20"
        fontWeight="900"
        letterSpacing="2.5"
        style={{ fontFamily: "var(--font-barlow),'Barlow Condensed',sans-serif" }}
      >
        FORZA
      </text>

      {/* ── MOTOS ── */}
      <text
        x="66"
        y="44"
        fill="#d42b2b"
        fontSize="20"
        fontWeight="900"
        letterSpacing="2.5"
        style={{ fontFamily: "var(--font-barlow),'Barlow Condensed',sans-serif" }}
      >
        MOTOS
      </text>
    </svg>
  )
}
