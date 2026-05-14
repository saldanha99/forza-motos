/**
 * Logos reais das marcas parceiras — usando arquivos SVG em /public/images/brands/
 */

interface LogoProps {
  height?: number
  className?: string
}

function BrandImg({ src, alt, height = 36, className = '' }: {
  src: string; alt: string; height?: number; className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      height={height}
      style={{ height, width: 'auto', maxWidth: '100%', display: 'block', objectFit: 'contain' }}
      className={className}
    />
  )
}

export function LogoPirelli({ height = 36, className = '' }: LogoProps) {
  return <BrandImg src="/images/brands/pirelli.svg" alt="Pirelli" height={height} className={className} />
}

export function LogoMichelin({ height = 36, className = '' }: LogoProps) {
  return <BrandImg src="/images/brands/michelin.svg" alt="Michelin" height={height} className={className} />
}

export function LogoMetzeler({ height = 36, className = '' }: LogoProps) {
  return <BrandImg src="/images/brands/metzeler.svg" alt="Metzeler" height={height} className={className} />
}

export function LogoBridgestone({ height = 36, className = '' }: LogoProps) {
  return <BrandImg src="/images/brands/bridgestone.svg" alt="Bridgestone" height={height} className={className} />
}

export function LogoMotul({ height = 36, className = '' }: LogoProps) {
  return <BrandImg src="/images/brands/motul.svg" alt="Motul" height={height} className={className} />
}

export function LogoEBC({ height = 40, className = '' }: LogoProps) {
  return <BrandImg src="/images/brands/ebc.svg" alt="EBC Brakes" height={height} className={className} />
}

export function LogoDID({ height = 40, className = '' }: LogoProps) {
  return <BrandImg src="/images/brands/did.svg" alt="D.I.D. Racing Chain" height={height} className={className} />
}
