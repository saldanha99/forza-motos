import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

const variants = {
  default: 'bg-zinc-800 text-zinc-300',
  success: 'bg-green-900/50 text-green-400 border border-green-800',
  warning: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
  danger: 'bg-red-900/50 text-red-400 border border-red-800',
  info: 'bg-blue-900/50 text-blue-400 border border-blue-800',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    AGUARDANDO_PAGAMENTO: { label: 'Aguardando Pagamento', variant: 'warning' },
    CONFIRMADO: { label: 'Confirmado', variant: 'info' },
    SEPARANDO: { label: 'Separando', variant: 'info' },
    ENVIADO: { label: 'Enviado', variant: 'success' },
    ENTREGUE: { label: 'Entregue', variant: 'success' },
    CANCELADO: { label: 'Cancelado', variant: 'danger' },
    pendente: { label: 'Pendente', variant: 'warning' },
    confirmado: { label: 'Confirmado', variant: 'info' },
    concluido: { label: 'Concluído', variant: 'success' },
  }
  const s = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={s.variant}>{s.label}</Badge>
}
