/**
 * SVG logos das marcas parceiras
 */

interface LogoProps {
  height?: number
  className?: string
}

export function LogoPirelli({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (120 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 120 36" fill="none" className={className}>
      <rect x="0" y="0" width="36" height="36" rx="4" fill="#F5C800"/>
      <text x="18" y="26" textAnchor="middle" fill="#000" fontSize="24" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="-1">P</text>
      <text x="44" y="25" fill="#1a1a1a" fontSize="17" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="1.5">PIRELLI</text>
    </svg>
  )
}

export function LogoMichelin({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (160 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 160 36" fill="none" className={className}>
      <rect x="0" y="4" width="36" height="28" rx="3" fill="#003189"/>
      <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900" fontFamily="Arial Black, Arial">MAN</text>
      <text x="44" y="25" fill="#003189" fontSize="17" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0.5">MICHELIN</text>
    </svg>
  )
}

export function LogoMetzeler({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (155 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 155 36" fill="none" className={className}>
      <polygon points="18,2 34,18 18,34 2,18" fill="#CC0000"/>
      <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900" fontFamily="Arial Black, Arial">M</text>
      <text x="42" y="25" fill="#1a1a1a" fontSize="17" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0.5">METZELER</text>
    </svg>
  )
}

export function LogoBridgestone({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (190 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 190 36" fill="none" className={className}>
      <rect x="0" y="2" width="32" height="32" rx="3" fill="#E3000F"/>
      <text x="16" y="24" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="900" fontFamily="Arial Black, Arial">B</text>
      <text x="40" y="25" fill="#1a1a1a" fontSize="15" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0.3">BRIDGESTONE</text>
    </svg>
  )
}

export function LogoRinaldi({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (140 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 140 36" fill="none" className={className}>
      <rect x="0" y="2" width="32" height="32" rx="3" fill="#1a1a1a"/>
      <text x="16" y="24" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900" fontFamily="Arial Black, Arial">R</text>
      <text x="40" y="25" fill="#1a1a1a" fontSize="17" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0.5">RINALDI</text>
    </svg>
  )
}

export function LogoMotul({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (115 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 115 36" fill="none" className={className}>
      {/* Red left block */}
      <rect x="0" y="0" width="36" height="36" rx="3" fill="#CC0000"/>
      {/* M letter */}
      <text x="18" y="25" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="900" fontFamily="Arial Black, Arial">M</text>
      {/* OTUL */}
      <text x="44" y="25" fill="#CC0000" fontSize="19" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0.5">OTUL</text>
    </svg>
  )
}

export function LogoEBC({ height = 36, className = '' }: LogoProps) {
  // Proporção real: ~500x265 → ~1.89:1
  const w = Math.round(height * 1.9)
  return (
    <svg height={height} width={w} viewBox="0 0 190 100" fill="none" className={className}>
      {/* EBC — letras sólidas azul marinho, estilo real */}
      <text
        x="4" y="72"
        fill="#1B3A8C"
        fontSize="78"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="-2"
      >EBC</text>
      {/* BRAKES — vermelho abaixo, alinhado à direita do EBC */}
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

export function LogoDID({ height = 36, className = '' }: LogoProps) {
  // Proporção real: ~575x265 → ~2.17:1
  const w = Math.round(height * 2.2)
  return (
    <svg height={height} width={w} viewBox="0 0 220 100" fill="none" className={className}>
      {/* D.I.D. — vermelho bold, estilo bloco real */}
      <text
        x="2" y="62"
        fill="#CC0000"
        fontSize="66"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="2"
      >D.I.D.</text>
      {/* Racing Chain — cursive escuro */}
      <text
        x="6" y="82"
        fill="#1a1a1a"
        fontSize="18"
        fontWeight="400"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        letterSpacing="1"
      >Racing Chain</text>
      {/* Powered by Technology — vermelho pequeno */}
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
