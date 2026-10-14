/**
 * Ícones das categorias da loja — desenho próprio, em SVG.
 *
 * Mora fora do Header porque a arte dos blocos sem foto (ArteSlot) usa os
 * mesmos traços: a loja fica com uma linguagem visual só, e não com um ícone
 * no menu e outro no card da mesma categoria.
 */

export type IdCategoria =
  | 'pneus'
  | 'oleo'
  | 'freios'
  | 'transmissao'
  | 'filtros'
  | 'servicos'
  | 'capacetes'
  | 'eventos'
  | 'entrega'

export function IconeCategoria({
  id,
  cor = '#d42b2b',
  tamanho = 28,
  opacidade = 1,
}: {
  id: IdCategoria
  cor?: string
  tamanho?: number
  opacidade?: number
}) {
  const comum = {
    width: tamanho,
    height: tamanho,
    viewBox: '0 0 28 28',
    fill: 'none' as const,
    style: { opacity: opacidade },
    'aria-hidden': true,
  }

  if (id === 'pneus')
    return (
      <svg {...comum}>
        <circle cx="14" cy="14" r="11" stroke={cor} strokeWidth="2.5" />
        <circle cx="14" cy="14" r="4.5" fill={cor} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => {
          const r = (a * Math.PI) / 180
          return <circle key={i} cx={14 + 9 * Math.cos(r)} cy={14 + 9 * Math.sin(r)} r="1.6" fill={cor} />
        })}
      </svg>
    )

  if (id === 'oleo')
    return (
      <svg {...comum}>
        <path d="M10 4h8v3H10z" fill={cor} />
        <path d="M9 7h10v3l2 4v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8l2-4V7z" fill={cor} />
        <rect x="10" y="16" width="8" height="2" rx="1" fill="#fff" opacity="0.45" />
      </svg>
    )

  if (id === 'freios')
    return (
      <svg {...comum}>
        <circle cx="14" cy="14" r="11" stroke={cor} strokeWidth="2" />
        <circle cx="14" cy="14" r="4.5" fill="none" stroke={cor} strokeWidth="1.5" />
        {[0, 60, 120, 180, 240, 300].map((a, i) => {
          const r = (a * Math.PI) / 180
          return <circle key={i} cx={14 + 10.5 * Math.cos(r)} cy={14 + 10.5 * Math.sin(r)} r="1.8" fill={cor} />
        })}
      </svg>
    )

  if (id === 'transmissao')
    return (
      <svg {...comum}>
        <rect x="1" y="9.5" width="9" height="9" rx="3" stroke={cor} strokeWidth="2" />
        <rect x="18" y="9.5" width="9" height="9" rx="3" stroke={cor} strokeWidth="2" />
        <line x1="10" y1="14" x2="18" y2="14" stroke={cor} strokeWidth="2.5" />
      </svg>
    )

  if (id === 'filtros')
    return (
      <svg {...comum}>
        <ellipse cx="14" cy="8.5" rx="8" ry="3.5" stroke={cor} strokeWidth="2.2" />
        <path d="M6 8.5v11c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5v-11" stroke={cor} strokeWidth="2.2" />
      </svg>
    )

  if (id === 'servicos')
    return (
      <svg {...comum}>
        <rect x="8" y="2" width="4" height="11" rx="2" stroke={cor} strokeWidth="2" />
        <rect x="16" y="2" width="4" height="11" rx="2" stroke={cor} strokeWidth="2" />
        <path d="M8 13C6 15 6 19 8 21 6 23 6 26 8 26" stroke={cor} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M20 13C22 15 22 19 20 21 22 23 22 26 20 26" stroke={cor} strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    )

  if (id === 'capacetes')
    return (
      <svg {...comum}>
        <path d="M3.5 18c0-5.8 4.7-12 10.5-12S24.5 12.2 24.5 18H3.5z" stroke={cor} strokeWidth="2" fill="none" />
        <path d="M3.5 18h21" stroke={cor} strokeWidth="2" />
        <path d="M6.5 18c0 2.5 2 4.5 7.5 4.5s7.5-2 7.5-4.5" stroke={cor} strokeWidth="1.8" fill="none" />
        <rect x="6" y="12.5" width="16" height="5.5" rx="1.5" fill={cor} opacity="0.35" />
      </svg>
    )

  if (id === 'entrega')
    return (
      <svg {...comum}>
        <rect x="1" y="6" width="15" height="12" rx="1.5" stroke={cor} strokeWidth="2" />
        <path d="M16 10h5l3 5v3h-8v-8z" stroke={cor} strokeWidth="2" fill="none" />
        <circle cx="6.5" cy="20.5" r="2.5" stroke={cor} strokeWidth="2" />
        <circle cx="18.5" cy="20.5" r="2.5" stroke={cor} strokeWidth="2" />
      </svg>
    )

  // eventos
  return (
    <svg {...comum}>
      <rect x="3" y="6" width="22" height="19" rx="2.5" stroke={cor} strokeWidth="2" />
      <line x1="3" y1="12" x2="25" y2="12" stroke={cor} strokeWidth="2" />
      <line x1="9" y1="3" x2="9" y2="9" stroke={cor} strokeWidth="2" strokeLinecap="round" />
      <line x1="19" y1="3" x2="19" y2="9" stroke={cor} strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="18" r="1.5" fill={cor} />
      <circle cx="14" cy="18" r="1.5" fill={cor} />
      <circle cx="19" cy="18" r="1.5" fill={cor} />
    </svg>
  )
}
