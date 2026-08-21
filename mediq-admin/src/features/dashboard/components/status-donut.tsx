import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatusData {
  name: string
  value: number
}

interface StatusDonutProps {
  data?: StatusData[]
  isLoading: boolean
}

const COLORS = [
  'var(--primary)',
  'var(--chart-2, #22c55e)',
  'var(--chart-3, #f59e0b)',
  'var(--chart-4, #ef4444)',
  'var(--chart-5, #8b5cf6)',
  'var(--muted-foreground)',
]

export function StatusDonut({ data, isLoading }: StatusDonutProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>By Status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className='h-56 w-full' />
        ) : data.length === 0 ? (
          <p className='py-10 text-center text-sm text-muted-foreground'>
            No data available.
          </p>
        ) : (
          <div className='flex items-center gap-4'>
            <div className='h-56 w-56'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    data={data}
                    cx='50%'
                    cy='50%'
                    innerRadius={60}
                    outerRadius={90}
                    dataKey='value'
                    stroke='var(--background)'
                    strokeWidth={2}
                  >
                    {data.map((_, i) => (
                      <Cell
                        key={i}
                        fill={COLORS[i % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className='flex flex-col gap-2'>
              {data.map((entry, i) => (
                <div key={entry.name} className='flex items-center gap-2 text-sm'>
                  <span
                    className='inline-block h-3 w-3 rounded-full'
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className='text-muted-foreground capitalize'>
                    {entry.name.replace('_', ' ')}
                  </span>
                  <span className='font-medium'>{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
