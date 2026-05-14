/**
 * SVG logos das marcas parceiras
 * Usados na página de pneus e em outros lugares
 */

interface LogoProps {
  height?: number
  className?: string
}

export function LogoPirelli({ height = 36, className = '' }: LogoProps) {
  return (
    <svg height={height} viewBox="0 0 120 36" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* P badge */}
      <rect x="0" y="0" width="36" height="36" rx="4" fill="#F5C800"/>
      <text x="18" y="26" textAnchor="middle" fill="#000" fontSize="24" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="-1">P</text>
      {/* PIRELLI text */}
      <text x="44" y="25" fill="#1a1a1a" fontSize="17" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="1.5">PIRELLI</text>
    </svg>
  )
}

export function LogoMichelin({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (160 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 160 36" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Blue rectangle badge */}
      <rect x="0" y="4" width="36" height="28" rx="3" fill="#003189"/>
      <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0">MAN</text>
      {/* MICHELIN text */}
      <text x="44" y="25" fill="#003189" fontSize="17" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0.5">MICHELIN</text>
    </svg>
  )
}

export function LogoMetzeler({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (155 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 155 36" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* M diamond badge */}
      <polygon points="18,2 34,18 18,34 2,18" fill="#CC0000"/>
      <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900" fontFamily="Arial Black, Arial">M</text>
      {/* METZELER text */}
      <text x="42" y="25" fill="#1a1a1a" fontSize="17" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0.5">METZELER</text>
    </svg>
  )
}

export function LogoBridgestone({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (190 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 190 36" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* B badge */}
      <rect x="0" y="2" width="32" height="32" rx="3" fill="#E3000F"/>
      <text x="16" y="24" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="900" fontFamily="Arial Black, Arial">B</text>
      {/* BRIDGESTONE text */}
      <text x="40" y="25" fill="#1a1a1a" fontSize="15" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0.3">BRIDGESTONE</text>
    </svg>
  )
}

export function LogoRinaldi({ height = 36, className = '' }: LogoProps) {
  const w = Math.round(height * (140 / 36))
  return (
    <svg height={height} width={w} viewBox="0 0 140 36" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="2" width="32" height="32" rx="3" fill="#1a1a1a"/>
      <text x="16" y="24" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900" fontFamily="Arial Black, Arial">R</text>
      <text x="40" y="25" fill="#1a1a1a" fontSize="17" fontWeight="900" fontFamily="Arial Black, Arial" letterSpacing="0.5">RINALDI</text>
    </svg>
  )
}
