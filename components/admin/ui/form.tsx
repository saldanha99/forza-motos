'use client'

import { forwardRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════════
   Campos de formulário

   Uma receita só de input para o painel inteiro. Sem hex, sem `dark:`:
   tudo sai dos tokens e funciona nos dois temas.
   ═══════════════════════════════════════════════════════════════════ */

export const INPUT_BASE = cn(
  'w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text',
  'placeholder:text-brand-dim transition-colors',
  'focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

/** Rótulo + dica + erro em volta de qualquer controle. */
export function Campo({
  label,
  dica,
  erro,
  obrigatorio,
  htmlFor,
  children,
  className,
}: {
  label: string
  /** Explica a regra do campo antes do erro acontecer. */
  dica?: string
  erro?: string
  obrigatorio?: boolean
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dim"
      >
        {label}
        {obrigatorio && <span className="ml-1 text-brand-accent">*</span>}
      </label>
      {children}
      {erro ? (
        <p className="text-xs font-medium text-brand-danger">{erro}</p>
      ) : (
        dica && <p className="text-xs text-brand-muted">{dica}</p>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(INPUT_BASE, className)} {...props} />
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(INPUT_BASE, 'min-h-[96px] resize-y', className)} {...props} />
})

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(INPUT_BASE, 'cursor-pointer pr-8', className)} {...props}>
      {children}
    </select>
  )
})

/** Interruptor com rótulo clicável — substitui checkbox solto. */
export function Switch({
  checked,
  onChange,
  label,
  descricao,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  descricao?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2.5 text-left transition-colors',
        'hover:border-brand-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand-accent' : 'bg-brand-elevated',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-brand-surface transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-brand-text">{label}</span>
        {descricao && <span className="mt-0.5 block text-xs text-brand-muted">{descricao}</span>}
      </span>
    </button>
  )
}

/**
 * Escolha única entre poucas opções (até ~5).
 *
 * Com esse número de alternativas, mostrar todas de uma vez é mais rápido de
 * ler e de clicar do que abrir um `Select` — e o estado atual fica visível
 * sem interação.
 */
export function GrupoOpcoes<T extends string>({
  valor,
  opcoes,
  onChange,
  disabled,
  className,
}: {
  valor: T
  opcoes: { valor: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'flex flex-wrap gap-0.5 rounded-xl border border-brand-border bg-brand-surface-2 p-0.5',
        className,
      )}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            disabled={disabled}
            onClick={() => onChange(o.valor)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              ativo
                ? 'bg-brand-accent text-brand-on-accent shadow-cta'
                : 'text-brand-muted hover:text-brand-text',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Rodapé fixo de formulário — as ações ficam sempre no mesmo lugar. */
export function AcoesFormulario({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-brand-hair pt-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Paginação — uma só para todas as listagens
   ═══════════════════════════════════════════════════════════════════ */

export function Paginacao({
  paginaAtual,
  totalPaginas,
  href,
  className,
}: {
  paginaAtual: number
  totalPaginas: number
  /** Recebe o número da página e devolve a URL. */
  href: (pagina: number) => string
  className?: string
}) {
  if (totalPaginas <= 1) return null

  // Janela deslizante: primeira, última e as vizinhas da atual
  const paginas: (number | '…')[] = []
  for (let p = 1; p <= totalPaginas; p++) {
    if (p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 1) paginas.push(p)
    else if (paginas[paginas.length - 1] !== '…') paginas.push('…')
  }

  const seta =
    'flex h-7 w-7 items-center justify-center rounded-lg border border-brand-border text-brand-muted transition-colors hover:border-brand-accent hover:text-brand-text'

  return (
    <nav aria-label="Paginação" className={cn('flex flex-wrap items-center gap-1', className)}>
      {paginaAtual > 1 && (
        <Link href={href(paginaAtual - 1)} aria-label="Página anterior" className={seta}>
          <ChevronLeft size={14} />
        </Link>
      )}
      {paginas.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-brand-dim">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === paginaAtual ? 'page' : undefined}
            className={cn(
              'flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-semibold tabular-nums transition-all',
              p === paginaAtual
                ? 'bg-brand-accent text-brand-on-accent'
                : 'border border-brand-border text-brand-muted hover:border-brand-accent hover:text-brand-text',
            )}
          >
            {p}
          </Link>
        ),
      )}
      {paginaAtual < totalPaginas && (
        <Link href={href(paginaAtual + 1)} aria-label="Próxima página" className={seta}>
          <ChevronRight size={14} />
        </Link>
      )}
    </nav>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Modal
   ═══════════════════════════════════════════════════════════════════ */

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = 'max-w-lg',
}: {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao?: string
  children: React.ReactNode
  rodape?: React.ReactNode
  largura?: string
}) {
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', onKey)
    // Trava o scroll do fundo enquanto o modal está aberto
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = anterior
    }
  }, [aberto, aoFechar])

  if (!aberto) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[color:var(--brand-overlay)] p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <div
        className={cn(
          'w-full overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-pop',
          largura,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-brand-hair px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-barlow text-lg font-bold text-brand-text">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-xs text-brand-muted">{descricao}</p>}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1 text-brand-dim transition-colors hover:bg-brand-tint-2 hover:text-brand-text"
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-scroll max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

        {rodape && (
          <div className="flex items-center justify-end gap-2 border-t border-brand-hair bg-brand-surface-2 px-5 py-3">
            {rodape}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Skeleton
   ═══════════════════════════════════════════════════════════════════ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-brand-elevated', className)} />
}
