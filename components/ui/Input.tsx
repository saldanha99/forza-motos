import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm text-zinc-400 font-medium">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2.5 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-vermelho transition-colors',
            error && 'border-red-500',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'
