import Image from 'next/image'

interface LogoSVGProps {
  /** true = contexto escuro (adiciona fundo branco arredondado atrás do logo) */
  dark?: boolean
  height?: number
  className?: string
}

/**
 * Logo real da Forza Motos (PNG).
 * - dark=true  → contexto escuro: exibe o logo com fundo branco arredondado
 * - dark=false → contexto claro: exibe direto (fundo da imagem é branco)
 */
export function LogoSVG({ dark = false, height = 40, className = '' }: LogoSVGProps) {
  // Proporção original do logo: 1200×900 ≈ 4:3 → largura = height * 1.55 (sem o texto abaixo seria 1.33)
  // Com o texto "FORZAMOTOS" abaixo a proporção real é ~1200x900 = 4:3
  const width = Math.round(height * (4 / 3))

  if (dark) {
    return (
      <div
        className={`inline-flex items-center justify-center bg-white rounded-xl px-2 ${className}`}
        style={{ height: height + 8, width: width + 16 }}
      >
        <Image
          src="/images/logo-forza.png"
          alt="Forza Motos"
          width={width}
          height={height}
          style={{ objectFit: 'contain', height, width }}
          priority
        />
      </div>
    )
  }

  return (
    <Image
      src="/images/logo-forza.png"
      alt="Forza Motos"
      width={width}
      height={height}
      style={{ objectFit: 'contain', height, width }}
      className={className}
      priority
    />
  )
}
