'use client'

/**
 * Pneu desenhado em SVG puro (sem imagem externa) com a medida gravada na
 * parede lateral — a mesma leitura que o cliente faz no pneu real.
 * A inscrição acompanha o funil de busca em tempo real.
 *
 * Realismo: grão de borracha (feTurbulence em soft-light), blocos da banda
 * recortados no disco, canais circulares, aro de alumínio com varredura,
 * brilho especular e sombra de contato.
 */

/** Blocos da banda de rodagem — alternam profundidade, como pneu de moto */
const SULCOS = Array.from({ length: 40 }, (_, i) => ({
  ang: i * 9,
  opacidade: i % 2 ? 0.55 : 0.38,
}))

const RAIOS = [0, 72, 144, 216, 288]

export function PneuRealista({
  largura,
  perfil,
  aro,
  className = '',
}: {
  largura: number | null
  perfil: number | null
  aro: number | null
  className?: string
}) {
  const completo = largura != null && perfil != null && aro != null
  // Placeholders mantêm o comprimento da inscrição estável enquanto escolhe
  const inscricao = `${largura ?? '000'}/${perfil ?? '00'} R${aro ?? '00'}`

  return (
    <svg
      viewBox="0 0 260 260"
      className={className}
      role="img"
      aria-label={
        completo
          ? `Pneu na medida ${largura}/${perfil}-${aro}`
          : 'Ilustração de pneu: a medida fica gravada na parede lateral'
      }
    >
      <defs>
        <radialGradient id="fm-borracha" cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#3c3c44" />
          <stop offset="45%" stopColor="#1e1e24" />
          <stop offset="80%" stopColor="#101014" />
          <stop offset="100%" stopColor="#050507" />
        </radialGradient>

        <radialGradient id="fm-parede" cx="38%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#2f2f37" />
          <stop offset="65%" stopColor="#17171c" />
          <stop offset="100%" stopColor="#0a0a0d" />
        </radialGradient>

        {/* Alumínio usinado: claro/escuro alternado dá o reflexo do metal */}
        <linearGradient id="fm-aro" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#eef1f5" />
          <stop offset="30%" stopColor="#8d949f" />
          <stop offset="52%" stopColor="#dfe3e9" />
          <stop offset="74%" stopColor="#6d747e" />
          <stop offset="100%" stopColor="#b9bfc8" />
        </linearGradient>

        <radialGradient id="fm-luz" cx="36%" cy="20%" r="46%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        <filter id="fm-grao" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
          <feComponentTransfer result="nn">
            <feFuncA type="linear" slope="0.12" />
          </feComponentTransfer>
          <feComposite in="nn" in2="SourceGraphic" operator="in" result="m" />
          <feBlend in="SourceGraphic" in2="m" mode="soft-light" />
        </filter>

        <path id="fm-linha" d="M 130,130 m -84,0 a 84,84 0 1,1 168,0 a 84,84 0 1,1 -168,0" />
        {/* Mesmo círculo em sentido anti-horário: texto de baixo sai legível */}
        <path id="fm-linha-inv" d="M 130,130 m -84,0 a 84,84 0 1,0 168,0 a 84,84 0 1,0 -168,0" />
        <clipPath id="fm-banda">
          <circle cx="130" cy="130" r="120" />
        </clipPath>
      </defs>

      {/* Sombra de contato com o chão */}
      <ellipse cx="130" cy="246" rx="82" ry="8" fill="#000" opacity="0.5" />

      {/* Borracha */}
      <circle cx="130" cy="130" r="120" fill="url(#fm-borracha)" filter="url(#fm-grao)" />

      {/* Blocos da banda */}
      <g clipPath="url(#fm-banda)" opacity="0.85">
        {SULCOS.map((s) => (
          <path
            key={s.ang}
            d="M 124,10 L 136,10 L 133,40 L 121,40 Z"
            transform={`rotate(${s.ang} 130 130)`}
            fill="#000"
            opacity={s.opacidade}
          />
        ))}
      </g>

      {/* Canais circulares */}
      <circle cx="130" cy="130" r="113" fill="none" stroke="#000" strokeWidth="2.5" opacity="0.55" />
      <circle cx="130" cy="130" r="99" fill="none" stroke="#000" strokeWidth="3" opacity="0.45" />

      {/* Ombro e parede lateral */}
      <circle cx="130" cy="130" r="97" fill="url(#fm-parede)" filter="url(#fm-grao)" />
      <circle cx="130" cy="130" r="97" fill="none" stroke="#000" strokeWidth="2" opacity="0.6" />
      <circle cx="130" cy="130" r="92" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.07" />

      {/* Inscrição gravada — o coração da metáfora */}
      <text
        fill={completo ? '#e4e4ea' : '#8a8a93'}
        fontSize="15"
        fontWeight="700"
        letterSpacing="3"
        style={{ fontFamily: 'var(--font-barlow), system-ui, sans-serif' }}
      >
        <textPath href="#fm-linha" startOffset="25%" textAnchor="middle">
          {inscricao}
        </textPath>
      </text>
      <text
        fill="#55555f"
        fontSize="8"
        fontWeight="600"
        letterSpacing="2.4"
        style={{ fontFamily: 'var(--font-barlow), system-ui, sans-serif' }}
      >
        <textPath href="#fm-linha-inv" startOffset="25%" textAnchor="middle">
          FORZA MOTOS
        </textPath>
      </text>

      {/* Aro */}
      <circle cx="130" cy="130" r="60" fill="#0d0d10" />
      <circle cx="130" cy="130" r="60" fill="none" stroke="url(#fm-aro)" strokeWidth="7" />
      <circle cx="130" cy="130" r="55" fill="none" stroke="#000" strokeWidth="2" opacity="0.6" />

      {RAIOS.map((r) => (
        <path
          key={r}
          d="M 121.5,113 L 138.5,113 L 141.5,79 L 118.5,79 Z"
          transform={`rotate(${r} 130 130)`}
          fill="url(#fm-aro)"
          opacity="0.88"
        />
      ))}

      {/* Cubo */}
      <circle cx="130" cy="130" r="17" fill="url(#fm-aro)" />
      <circle cx="130" cy="130" r="17" fill="none" stroke="#41454c" strokeWidth="1" />
      <circle cx="130" cy="130" r="5.5" fill="#25282d" />

      {/* Especular por cima de tudo */}
      <circle cx="130" cy="130" r="120" fill="url(#fm-luz)" style={{ pointerEvents: 'none' }} />
    </svg>
  )
}
