import { cn } from '@/lib/utils'
import { definicaoStatus, type TomStatus } from '@/lib/admin/status'

/**
 * Pílula de status compartilhada entre a loja e o painel.
 *
 * As cores vêm dos tokens `--pill-*` (definidos em globals.css), que cada
 * tema redefine. Assim o mesmo componente funciona no "Meus pedidos" do
 * cliente e dentro do painel, no claro e no escuro, sem `dark:`.
 */

type Variante = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  children: React.ReactNode
  variant?: Variante
  className?: string
}

const ESTILO: Record<Variante, string> = {
  default: 'bg-[var(--pill-neutro-bg)]  text-[var(--pill-neutro)]',
  success: 'bg-[var(--pill-success-bg)] text-[var(--pill-success)]',
  warning: 'bg-[var(--pill-warning-bg)] text-[var(--pill-warning)]',
  danger:  'bg-[var(--pill-danger-bg)]  text-[var(--pill-danger)]',
  info:    'bg-[var(--pill-info-bg)]    text-[var(--pill-info)]',
}

/** Ponte entre o vocabulário de tons do painel e as variantes daqui. */
const POR_TOM: Record<TomStatus, Variante> = {
  success: 'success',
  warning: 'warning',
  danger:  'danger',
  info:    'info',
  accent:  'danger',
  neutro:  'default',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        ESTILO[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Rótulos vêm de `lib/admin/status` — um só lugar define como cada status
 * se chama, seja no painel ou na área do cliente.
 */
export function statusBadge(status: string) {
  const { label, tom } = definicaoStatus(status)
  // `accent` não tem token próprio de pílula — cai no vermelho de alerta
  const cor = tom === 'accent' ? 'danger' : tom
  return (
    <Badge variant={POR_TOM[tom]}>
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `var(--pill-${cor})` }}
      />
      {label}
    </Badge>
  )
}
