import { cn } from '@/lib/utils'

export function Card({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-zinc-900 border border-zinc-800 rounded-lg',
        className
      )}
    >
      {children}
    </div>
  )
}
