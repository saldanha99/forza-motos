/**
 * SVG logos das marcas parceiras — fiéis às logos reais
 */

interface LogoProps {
  height?: number
  className?: string
}

/* ─────────────────────────────────────────
   PIRELLI — arco vermelho icônico + IRELLI
───────────────────────────────────────── */
export function LogoPirelli({ height = 40, className = '' }: LogoProps) {
  const w = Math.round(height * (300 / 130))
  return (
    <svg height={height} width={w} viewBox="0 0 300 130" fill="none" className={className}>
      {/* Barra vertical esquerda — estende toda a altura */}
      <rect x="0" y="0" width="20" height="80" fill="#CC0000" />
      {/* Arco superior: retângulo + semicírculo direito */}
      <path
        d="M 0,0 L 240,0 Q 278,0 278,37 Q 278,76 240,76 L 0,76 Z"
        fill="#CC0000"
      />
      {/* Espaço interno branco (abertura do arco) */}
      <path
        d="M 20,18 L 222,18 Q 250,18 250,37 Q 250,58 222,58 L 20,58 Z"
        fill="white"
      />
      {/* Fenda horizontal branca que atravessa o arco — sinal característico */}
      <rect x="0" y="34" width="240" height="7" rx="3.5" fill="white" />
      {/* IRELLI abaixo */}
      <text
        x="2" y="124"
        fill="#CC0000"
        fontSize="50"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="4"
      >IRELLI</text>
    </svg>
  )
}

/* ─────────────────────────────────────────
   MICHELIN — retângulo azul + MICHELIN branco
───────────────────────────────────────── */
export function LogoMichelin({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (420 / 100))
  return (
    <svg height={height} width={w} viewBox="0 0 420 100" fill="none" className={className}>
      {/* Fundo azul */}
      <rect x="0" y="0" width="420" height="100" rx="4" fill="#009BDB" />
      {/* Linha amarela inferior — característica da logo */}
      <rect x="0" y="88" width="420" height="8" fill="#FFCF00" />
      {/* MICHELIN em branco itálico */}
      <text
        x="20" y="72"
        fill="white"
        fontSize="56"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        fontStyle="italic"
        letterSpacing="-1"
      >MICHELIN</text>
    </svg>
  )
}

/* ─────────────────────────────────────────
   METZELER — navy METZELER + "SHARING INDEPENDENCE"
───────────────────────────────────────── */
export function LogoMetzeler({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (380 / 80))
  return (
    <svg height={height} width={w} viewBox="0 0 380 80" fill="none" className={className}>
      {/* METZELER em azul marinho bold */}
      <text
        x="0" y="52"
        fill="#0D1B4B"
        fontSize="52"
        fontWeight="900"
        fontFamily="Arial Black, Impact, sans-serif"
        letterSpacing="0.5"
      >METZELER</text>
      {/* SHARING INDEPENDENCE — texto secundário */}
      <text
        x="2" y="72"
        fill="#0D1B4B"
        fontSize="15"
        fontWeight="700"
        fontFamily="Arial, sans-serif"
        letterSpacing="4"
      >SHARING INDEPENDENCE</text>
      {/* Círculo com elefante estilizado à direita */}
      <circle cx="360" cy="38" r="26" stroke="#0D1B4B" strokeWidth="2.5" fill="none" />
      {/* Elefante mínimo: cabeça + tromba + orelha */}
      <ellipse cx="358" cy="36" rx="12" ry="11" fill="#0D1B4B" />
      <ellipse cx="348" cy="32" rx="6" ry="8" fill="#0D1B4B" />
      <path d="M 353,46 Q 350,54 355,56 Q 360,58 358,50" stroke="#0D1B4B" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="364" cy="33" r="2" fill="white" />
    </svg>
  )
}

/* ─────────────────────────────────────────
   BRIDGESTONE — preto bold + B vermelho
───────────────────────────────────────── */
export function LogoBridgestone({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (500 / 80))
  return (
    <svg height={height} width={w} viewBox="0 0 500 80" fill="none" className={className}>
      {/* Triângulo vermelho no topo-esquerdo do B — característica icônica */}
      <polygon points="0,0 40,0 0,42" fill="#E3000F" />
      {/* BRIDGESTONE em preto negrito itálico */}
      <text
        x="6" y="72"
        fill="#1a1a1a"
        fontSize="68"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        fontStyle="italic"
        letterSpacing="-2"
      >BRIDGESTONE</text>
    </svg>
  )
}

/* ─────────────────────────────────────────
   MOTUL — retângulo vermelho + MOTUL branco
───────────────────────────────────────── */
export function LogoMotul({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (280 / 90))
  return (
    <svg height={height} width={w} viewBox="0 0 280 90" fill="none" className={className}>
      {/* Fundo vermelho sólido */}
      <rect x="0" y="0" width="280" height="90" fill="#EE1C25" />
      {/* MOTUL branco bold itálico */}
      <text
        x="12" y="74"
        fill="white"
        fontSize="70"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        fontStyle="italic"
        letterSpacing="-2"
      >MOTUL</text>
    </svg>
  )
}

/* ─────────────────────────────────────────
   EBC BRAKES — azul marinho + vermelho
───────────────────────────────────────── */
export function LogoEBC({ height = 40, className = '' }: LogoProps) {
  const w = Math.round(height * 1.9)
  return (
    <svg height={height} width={w} viewBox="0 0 190 100" fill="none" className={className}>
      <text
        x="4" y="72"
        fill="#1B3A8C"
        fontSize="78"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="-2"
      >EBC</text>
      <text
        x="4" y="95"
        fill="#E63228"
        fontSize="22"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="6"
      >BRAKES</text>
    </svg>
  )
}

/* ─────────────────────────────────────────
   D.I.D. RACING CHAIN — vermelho + cursivo
───────────────────────────────────────── */
export function LogoDID({ height = 40, className = '' }: LogoProps) {
  const w = Math.round(height * 2.2)
  return (
    <svg height={height} width={w} viewBox="0 0 220 100" fill="none" className={className}>
      <text
        x="2" y="62"
        fill="#CC0000"
        fontSize="66"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="2"
      >D.I.D.</text>
      <text
        x="6" y="82"
        fill="#1a1a1a"
        fontSize="18"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        letterSpacing="1"
      >Racing Chain</text>
      <text
        x="6" y="97"
        fill="#CC0000"
        fontSize="11"
        fontWeight="700"
        fontFamily="Arial, sans-serif"
        fontStyle="italic"
        letterSpacing="0.5"
      >Powered by Technology</text>
    </svg>
  )
}
