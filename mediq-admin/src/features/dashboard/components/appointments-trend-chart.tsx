import { format, parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface TrendData {
  date: string
  booked: number
  completed: number
}

interface AppointmentsTrendChartProps {
  data?: TrendData[]
  isLoading: boolean
  title?: string
}

// Format YYYY-MM-DD → 'Aug 3'
function fmtDate(d: string) {
  try { return format(parseISO(d), 'MMM d') } catch { return d }
}

export function AppointmentsTrendChart({
  data,
  isLoading,
  title = 'Appointment Trend',
}: AppointmentsTrendChartProps) {
  // Transform dates for display
  const displayData = data?.map((row) => ({ ...row, date: fmtDate(row.date) }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className='h-64 w-full' />
        ) : data.length === 0 ? (
          <p className='py-10 text-center text-sm text-muted-foreground'>
            No appointments in this period.
          </p>
        ) : (
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart
                data={displayData}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <CartesianGrid
                  horizontal
                  vertical={false}
                  stroke='var(--border)'
                  strokeDasharray='4 4'
                  strokeOpacity={0.6}
                />
                <XAxis
                  dataKey='date'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 12 }}
                  stroke='var(--muted-foreground)'
                  interval='preserveStartEnd'
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tick={{ fontSize: 12 }}
                  stroke='var(--muted-foreground)'
                  width={28}
                />
                <Tooltip
                  cursor={{
                    stroke: 'var(--muted-foreground)',
                    strokeDasharray: '4 4',
                    strokeOpacity: 0.4,
                  }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    fontSize: 12,
                  }}
                  labelStyle={{
                    color: 'var(--foreground)',
                    fontWeight: 600,
                  }}
                />
                <Area
                  type='monotone'
                  dataKey='booked'
                  stroke='var(--primary)'
                  fill='var(--primary)'
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: 'var(--background)',
                    strokeWidth: 2,
                  }}
                />
                <Area
                  type='monotone'
                  dataKey='completed'
                  stroke='var(--chart-2, #22c55e)'
                  fill='var(--chart-2, #22c55e)'
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: 'var(--background)',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
