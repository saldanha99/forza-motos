import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm text-dim font-medium">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-card border border-line rounded-md px-3 py-2.5 text-ink text-sm placeholder-faint focus:outline-none focus:ring-2 focus:ring-vermelho/30 focus:border-vermelho transition-colors',
            error && 'border-red-500 focus:ring-red-500/20',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'
