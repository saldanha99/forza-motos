import Image from 'next/image'

interface LogoSVGProps {
  /**
   * true = contexto escuro (cabeçalho e rodapé pretos).
   * O PNG tem fundo transparente e traz branco e vermelho no desenho, então
   * ele aparece direto sobre o preto — sem a plaquinha branca que encolhia a
   * marca e a deixava com cara de selo colado.
   */
  dark?: boolean
  height?: number
  className?: string
}

// Proporção real do arquivo: 1200×795. Usar 4/3 aqui reservava menos largura
// do que a marca precisa e, com objectFit "contain", o logo saía menor que a
// altura pedida — era parte do "logo pequeno demais".
const PROPORCAO = 1200 / 795

/** Logo oficial da Forza Motos (PNG com transparência). */
export function LogoSVG({ dark = false, height = 40, className = '' }: LogoSVGProps) {
  const width = Math.round(height * PROPORCAO)

  return (
    <Image
      src="/images/logo-forza.png"
      alt="Forza Motos"
      width={width}
      height={height}
      style={{ objectFit: 'contain', height, width }}
      className={`${dark ? 'drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]' : ''} ${className}`.trim()}
      priority
    />
  )
}
