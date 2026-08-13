import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/date-picker'
import { cn } from '@/lib/utils'

export type DashboardRange = 'today' | '7d' | '30d' | 'custom'

const presets: { key: DashboardRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'custom', label: 'Custom' },
]

type DashboardDateRangeProps = {
  range: DashboardRange
  onRangeChange: (range: DashboardRange) => void
  from: Date | undefined
  to: Date | undefined
  onFromChange: (date: Date | undefined) => void
  onToChange: (date: Date | undefined) => void
}

/**
 * Date-range selector for the dashboard: Today / 7 days / 30 days / Custom.
 * Custom reveals two date pickers so any range can be expressed.
 */
export function DashboardDateRange({
  range,
  onRangeChange,
  from,
  to,
  onFromChange,
  onToChange,
}: DashboardDateRangeProps) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <div
        className='flex items-center gap-1 rounded-lg border bg-muted/30 p-1'
        role='group'
        aria-label='Dashboard date range'
      >
        {presets.map((preset) => (
          <Button
            key={preset.key}
            type='button'
            size='sm'
            variant='ghost'
            aria-pressed={range === preset.key}
            className={cn(
              'h-7 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground',
              range === preset.key &&
                'bg-background text-foreground shadow-sm'
            )}
            onClick={() => onRangeChange(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {range === 'custom' && (
        <div className='flex flex-wrap items-center gap-2'>
          <DatePicker
            selected={from}
            onSelect={onFromChange}
            placeholder='From date'
            className='w-40'
          />
          <DatePicker
            selected={to}
            onSelect={onToChange}
            placeholder='To date'
            className='w-40'
          />
        </div>
      )}
    </div>
  )
}
