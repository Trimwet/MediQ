import { cn } from '@/lib/utils'

type WavePhysicsLoaderProps = {
  className?: string
  barCount?: number
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { barW: 'w-1', barGap: 'gap-1', maxH: 'h-6' },
  md: { barW: 'w-1.5', barGap: 'gap-1.5', maxH: 'h-10' },
  lg: { barW: 'w-2', barGap: 'gap-2', maxH: 'h-14' },
}

export function WavePhysicsLoader({
  className,
  barCount = 5,
  size = 'md',
}: WavePhysicsLoaderProps) {
  const s = sizeMap[size]
  return (
    <div
      className={cn(
        'flex items-end justify-center',
        s.barGap,
        s.maxH,
        className
      )}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: barCount }, (_, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full bg-current wave-bar',
            s.barW
          )}
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}
