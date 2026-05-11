'use client'

import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded font-rajdhani font-semibold uppercase tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-vermelho/50 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-vermelho hover:bg-red-700 text-white': variant === 'primary',
            'border border-vermelho text-vermelho hover:bg-vermelho hover:text-white': variant === 'outline',
            'text-zinc-300 hover:text-white hover:bg-zinc-800': variant === 'ghost',
            'bg-red-900 hover:bg-red-800 text-white': variant === 'danger',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-5 py-2.5 text-base': size === 'md',
            'px-8 py-3.5 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
