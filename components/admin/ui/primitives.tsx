import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { definicaoStatus, type TomStatus } from '@/lib/admin/status'

/* ═══════════════════════════════════════════════════════════════════
   Tons — um mapa só, usado por pill, badge, ícone e barra de coluna
   ═══════════════════════════════════════════════════════════════════ */

export const TOM_TEXTO: Record<TomStatus, string> = {
  success: 'text-brand-success',
  warning: 'text-brand-warning',
  danger:  'text-brand-danger',
  info:    'text-brand-info',
  accent:  'text-brand-accent',
  neutro:  'text-brand-muted',
}

export const TOM_FUNDO: Record<TomStatus, string> = {
  success: 'bg-brand-success-soft',
  warning: 'bg-brand-warning-soft',
  danger:  'bg-brand-danger-soft',
  info:    'bg-brand-info-soft',
  accent:  'bg-brand-accent-soft',
  neutro:  'bg-brand-neutral-soft',
}

export const TOM_PONTO: Record<TomStatus, string> = {
  success: 'bg-brand-success',
  warning: 'bg-brand-warning',
  danger:  'bg-brand-danger',
  info:    'bg-brand-info',
  accent:  'bg-brand-accent',
  neutro:  'bg-brand-dim',
}

/* ═══════════════════════════════════════════════════════════════════
   Card — a superfície base de tudo
   ═══════════════════════════════════════════════════════════════════ */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-brand-border bg-brand-surface shadow-card',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  titulo,
  acao,
  className,
}: {
  titulo: React.ReactNode
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-brand-hair px-5 py-3.5',
        className,
      )}
    >
      <h2 className="font-barlow text-lg font-bold text-brand-text">{titulo}</h2>
      {acao}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   PageHeader — todo módulo abre explicando o que ele faz
   ═══════════════════════════════════════════════════════════════════ */

export function PageHeader({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: string
  /** Frase em linguagem de operação: pra que serve esta tela. */
  descricao?: string
  acoes?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-barlow text-3xl font-black tracking-tight text-brand-text sm:text-4xl">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  )
}

export function SectionTitle({
  children,
  acao,
  className,
}: {
  children: React.ReactNode
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-dim">
        {children}
      </p>
      {acao}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Botões
   ═══════════════════════════════════════════════════════════════════ */

/** Exportado para telas que precisam de um estado fora das variantes padrão. */
export const BOTAO_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

export const BOTAO_VARIANTE = {
  primario:   'bg-brand-accent text-brand-on-accent hover:bg-brand-accent-hover shadow-cta',
  secundario: 'border border-brand-border bg-brand-surface-2 text-brand-text hover:border-brand-border-strong hover:bg-brand-elevated',
  fantasma:   'text-brand-muted hover:bg-brand-tint-2 hover:text-brand-text',
  perigo:     'bg-brand-danger text-brand-on-accent hover:brightness-95',
} as const

export const BOTAO_TAMANHO = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
} as const

type BotaoProps = {
  variante?: keyof typeof BOTAO_VARIANTE
  tamanho?: keyof typeof BOTAO_TAMANHO
}

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  className,
  ...props
}: BotaoProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(BOTAO_BASE, BOTAO_VARIANTE[variante], BOTAO_TAMANHO[tamanho], className)}
      {...props}
    />
  )
}

export function BotaoLink({
  variante = 'primario',
  tamanho = 'md',
  className,
  ...props
}: BotaoProps & React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(BOTAO_BASE, BOTAO_VARIANTE[variante], BOTAO_TAMANHO[tamanho], className)}
      {...props}
    />
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Status
   ═══════════════════════════════════════════════════════════════════ */

export function StatusPill({
  status,
  className,
  ponto = true,
}: {
  status: string
  className?: string
  ponto?: boolean
}) {
  const { label, tom } = definicaoStatus(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5',
        'text-[11px] font-bold uppercase tracking-wide',
        TOM_FUNDO[tom],
        TOM_TEXTO[tom],
        className,
      )}
    >
      {ponto && <span className={cn('h-1.5 w-1.5 rounded-full', TOM_PONTO[tom])} />}
      {label}
    </span>
  )
}

export function Badge({
  children,
  tom = 'neutro',
  className,
}: {
  children: React.ReactNode
  tom?: TomStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        TOM_FUNDO[tom],
        TOM_TEXTO[tom],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   EmptyState — sempre explica o que faz aparecer dado aqui
   ═══════════════════════════════════════════════════════════════════ */

export function EmptyState({
  icone: Icone,
  titulo,
  descricao,
  acao,
  compacto = false,
  className,
}: {
  icone?: LucideIcon
  titulo: string
  /** O que precisa acontecer para esta lista deixar de estar vazia. */
  descricao?: string
  acao?: React.ReactNode
  compacto?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-border text-center',
        compacto ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      {Icone && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-accent-soft text-brand-accent">
          <Icone size={20} />
        </span>
      )}
      <p className={cn('font-barlow font-bold text-brand-text', compacto ? 'text-sm' : 'text-lg')}>
        {titulo}
      </p>
      {descricao && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-brand-muted">{descricao}</p>
      )}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Filtros em pílula (substitui os <a> soltos das listagens)
   ═══════════════════════════════════════════════════════════════════ */

export function FilterChip({
  href,
  ativo,
  children,
  contagem,
}: {
  href: string
  ativo: boolean
  children: React.ReactNode
  contagem?: number
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
        ativo
          ? 'bg-brand-accent text-brand-on-accent shadow-cta'
          : 'border border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-border-strong hover:text-brand-text',
      )}
    >
      {children}
      {contagem !== undefined && (
        <span
          className={cn(
            'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
            ativo ? 'bg-brand-on-accent-soft' : 'bg-brand-tint-2',
          )}
        >
          {contagem}
        </span>
      )}
    </Link>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Tabela — casca com cabeçalho fixo e zebra sutil
   ═══════════════════════════════════════════════════════════════════ */

export function Tabela({
  cabecalho,
  children,
  rodape,
  className,
}: {
  cabecalho: React.ReactNode
  children: React.ReactNode
  rodape?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="admin-scroll overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-hair bg-brand-surface-2">
            <tr className="text-[11px] uppercase tracking-[0.12em] text-brand-dim">
              {cabecalho}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {rodape && (
        <div className="flex items-center justify-between gap-3 border-t border-brand-hair bg-brand-surface-2 px-5 py-3 text-xs text-brand-muted">
          {rodape}
        </div>
      )}
    </Card>
  )
}

export const THEAD_TH = 'px-5 py-3 text-left font-semibold'
export const TR_LINHA =
  'border-b border-brand-hair last:border-0 transition-colors hover:bg-brand-tint-1'
export const TD_CELULA = 'px-5 py-3.5 align-middle'
