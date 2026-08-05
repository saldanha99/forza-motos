import Link from 'next/link'
import { ArrowUpRight, LucideIcon, TrendingDown, TrendingUp } from 'lucide-react'
import { AnimatedNumber } from './AnimatedNumber'
import { TOM_FUNDO, TOM_TEXTO } from './ui/primitives'
import type { TomStatus } from '@/lib/admin/status'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: number | string
  icon: LucideIcon
  prefix?: string
  suffix?: string
  decimals?: number
  /** Cor do ícone — usa o mesmo vocabulário de tons do resto do painel. */
  tom?: TomStatus
  /** Linha de contexto abaixo do número ("vs. 12 ontem", "meta 40"). */
  detalhe?: string
  trend?: { value: number; label?: string }
  /** Se informado, o card inteiro vira link para o detalhamento. */
  href?: string
  className?: string
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  prefix,
  suffix,
  decimals,
  tom = 'accent',
  detalhe,
  trend,
  href,
  className,
}: Props) {
  const conteudo = (
    <>
      {/* Brilho radial no hover */}
      <div className="admin-kpi-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-dim">
            {label}
          </p>
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              TOM_FUNDO[tom],
              TOM_TEXTO[tom],
            )}
          >
            <Icon size={16} />
          </span>
        </div>

        <p className="font-barlow text-3xl font-bold tabular-nums text-brand-text">
          <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
        </p>

        <div className="mt-2 flex items-center gap-2">
          {trend !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                trend.value >= 0
                  ? 'bg-brand-success-soft text-brand-success'
                  : 'bg-brand-danger-soft text-brand-danger',
              )}
            >
              {trend.value >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {trend.value >= 0 ? '+' : ''}
              {trend.value}%
            </span>
          )}
          {(detalhe || trend?.label) && (
            <span className="truncate text-xs text-brand-muted">{detalhe ?? trend?.label}</span>
          )}
          {href && (
            <ArrowUpRight
              size={14}
              className="ml-auto shrink-0 text-brand-dim transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-accent"
            />
          )}
        </div>
      </div>
    </>
  )

  const classe = cn(
    'group relative block overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-5',
    'shadow-card transition duration-300 hover:border-brand-accent',
    href && 'hover:-translate-y-0.5 hover:shadow-pop',
    className,
  )

  if (href) {
    return (
      <Link href={href} className={classe}>
        {conteudo}
      </Link>
    )
  }

  return <div className={classe}>{conteudo}</div>
}
