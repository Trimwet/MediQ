import { CalendarCheck, CheckCircle, Clock, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AnalyticsSummary } from '@/data/supabase/repos'

interface AnalyticsCardsProps {
  data?: AnalyticsSummary
  isLoading: boolean
}

const cards = [
  {
    key: 'booked' as const,
    label: 'Today Booked',
    icon: CalendarCheck,
  },
  {
    key: 'completed' as const,
    label: 'Completed',
    icon: CheckCircle,
  },
  {
    key: 'pending' as const,
    label: 'Pending',
    icon: Clock,
  },
  {
    key: 'avgWait' as const,
    label: 'Avg Wait',
    icon: Timer,
  },
] as const

export function AnalyticsCards({ data, isLoading }: AnalyticsCardsProps) {
  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className='pt-6'>
            {isLoading || !data ? (
              <div className='space-y-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-8 w-16' />
              </div>
            ) : (
              <>
                <div className='flex items-center gap-2'>
                  <card.icon className='h-4 w-4 text-primary' />
                  <p className='text-sm text-muted-foreground'>{card.label}</p>
                </div>
                <p className='mt-1 text-3xl font-bold tracking-tight'>
                  {card.key === 'avgWait'
                    ? data.avgWaitMinutes != null
                      ? `${data.avgWaitMinutes} min`
                      : '--'
                    : card.key === 'booked'
                      ? data.today.booked
                      : card.key === 'completed'
                        ? data.today.completed
                        : data.today.pending}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
