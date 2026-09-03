import { CalendarCheck, CheckCircle, Clock, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AnalyticsSummary } from '@/data/supabase/repos'
import type { DashboardRange } from './date-range'

interface AnalyticsCardsProps {
  data?: AnalyticsSummary
  isLoading: boolean
  range?: DashboardRange
}

export function AnalyticsCards({ data, isLoading, range = 'today' }: AnalyticsCardsProps) {
  // For today: use today snapshot. For 7d/30d/custom: sum from the trend array
  // (which covers the full range) so the numbers reflect the selected period.
  const isToday = range === 'today'

  const totals = (() => {
    if (!data) return { booked: 0, completed: 0, pending: 0 }
    if (isToday) {
      return {
        booked: data.today.booked,
        completed: data.today.completed,
        pending: data.today.pending,
      }
    }
    // Sum booked + completed across all trend days
    const booked = data.trend.reduce((s, d) => s + d.booked, 0)
    const completed = data.trend.reduce((s, d) => s + d.completed, 0)
    // pending / cancelled / etc come from byStatus
    const pendingEntry = data.byStatus.find((b) => b.name === 'pending')
    return { booked, completed, pending: pendingEntry?.value ?? 0 }
  })()

  const periodLabel = isToday ? 'today' : range === '7d' ? 'last 7 days' : range === '30d' ? 'last 30 days' : 'period'

  const cards = [
    {
      key: 'booked',
      label: 'Booked',
      subtext: periodLabel,
      icon: CalendarCheck,
      value: totals.booked,
    },
    {
      key: 'completed',
      label: 'Completed',
      subtext: periodLabel,
      icon: CheckCircle,
      value: totals.completed,
    },
    {
      key: 'pending',
      label: 'Pending',
      subtext: 'awaiting confirmation',
      icon: Clock,
      value: totals.pending,
    },
    {
      key: 'avgWait',
      label: 'Avg Wait',
      subtext: 'minutes per patient',
      icon: Timer,
      value: data?.avgWaitMinutes != null ? `${data.avgWaitMinutes} min` : '--',
    },
  ] as const

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className='pt-6'>
            {isLoading || !data ? (
              <div className='space-y-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-8 w-16' />
                <Skeleton className='h-3 w-20' />
              </div>
            ) : (
              <>
                <div className='flex items-center gap-2'>
                  <card.icon className='h-4 w-4 text-primary' />
                  <p className='text-sm text-muted-foreground'>{card.label}</p>
                </div>
                <p className='mt-1 text-3xl font-bold tracking-tight'>
                  {card.value}
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>{card.subtext}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
