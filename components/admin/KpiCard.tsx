import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react'
import { AnimatedNumber } from './AnimatedNumber'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: number | string
  icon: LucideIcon
  prefix?: string
  suffix?: string
  decimals?: number
  trend?: { value: number; label?: string }
  className?: string
}

export function KpiCard({ label, value, icon: Icon, prefix, suffix, decimals, trend, className }: Props) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden admin-glass !bg-black/20 border border-brand-border/30 hover:border-brand-accent/40 rounded-2xl p-5 transition-all duration-300 card-lift shadow-lg shadow-black/20 hover:shadow-brand-accent/5',
        className,
      )}
    >
      {/* Top accent line */}
      <span className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-accent to-brand-accent-hover rounded-t-2xl opacity-80" />

      {/* Radial glow on hover */}
      <div className="admin-kpi-glow absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs text-brand-muted uppercase tracking-widest font-medium">{label}</p>
          <div className="bg-brand-accent/10 text-brand-accent rounded-xl p-2 shrink-0">
            <Icon size={16} />
          </div>
        </div>

        {/* Value */}
        <p className="font-barlow font-bold text-3xl text-brand-text">
          <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
        </p>

        {/* Trend badge */}
        {trend !== undefined && (
          <div className={cn(
            'inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2 py-0.5 rounded-full',
            trend.value >= 0
              ? 'text-emerald-400 bg-emerald-400/10'
              : 'text-red-400 bg-red-400/10',
          )}>
            {trend.value >= 0
              ? <TrendingUp size={11} />
              : <TrendingDown size={11} />}
            {trend.value >= 0 ? '+' : ''}{trend.value}%
            {trend.label && <span className="text-brand-muted font-normal ml-1">{trend.label}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
