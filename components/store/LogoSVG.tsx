import Image from 'next/image'

type Variante = 'horizontal' | 'empilhado'

interface LogoSVGProps {
  /**
   * true = contexto escuro (cabeçalho e rodapé pretos).
   * O PNG tem fundo transparente e traz branco e vermelho no desenho, então
   * ele aparece direto sobre o preto — sem a plaquinha branca que encolhia a
   * marca e a deixava com cara de selo colado.
   */
  dark?: boolean
  /**
   * `horizontal` = emblema ao lado do letreiro (cabeçalho). É a versão que dá
   * presença à marca numa faixa baixa: na vertical, a mesma altura espreme o
   * "FORZA MOTOS" a ponto de não se ler — foi o que o cliente apontou.
   * `empilhado` = arte original, emblema sobre o letreiro (rodapé).
   */
  variante?: Variante
  height?: number
  className?: string
}

// Proporção real de cada arquivo. Usar a proporção errada aqui reserva menos
// largura do que a marca precisa e, com objectFit "contain", o logo sai menor
// que a altura pedida.
const ARTE: Record<Variante, { src: string; proporcao: number }> = {
  horizontal: { src: '/images/logo-forza-horizontal.png', proporcao: 1567 / 300 },
  empilhado: { src: '/images/logo-forza.png', proporcao: 1200 / 795 },
}

/** Logo oficial da Forza Motos (PNG com transparência). */
export function LogoSVG({
  dark = false,
  variante = 'empilhado',
  height = 40,
  className = '',
}: LogoSVGProps) {
  const { src, proporcao } = ARTE[variante]
  const width = Math.round(height * proporcao)

  return (
    <Image
      src={src}
      alt="Forza Motos"
      width={width}
      height={height}
      style={{ objectFit: 'contain', height, width }}
      className={`${dark ? 'drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]' : ''} ${className}`.trim()}
      priority
    />
  )
}
