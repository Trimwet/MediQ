import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface DoctorData {
  name: string
  completed: number
}

interface DoctorUtilizationChartProps {
  data?: DoctorData[]
  isLoading: boolean
}

export function DoctorUtilizationChart({
  data,
  isLoading,
}: DoctorUtilizationChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Doctor Utilization</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className='h-56 w-full' />
        ) : data.length === 0 ? (
          <p className='py-10 text-center text-sm text-muted-foreground'>
            No data available.
          </p>
        ) : (
          <div className='h-56 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart
                data={data}
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
                  dataKey='name'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  stroke='var(--muted-foreground)'
                  interval={0}
                  angle={-30}
                  textAnchor='end'
                  height={48}
                  tickFormatter={(v: string) =>
                    v.startsWith('Dr.') ? v.replace('Dr. ', '') : v.split(' ')[0]
                  }
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
                    fill: 'var(--muted)',
                    fillOpacity: 0.3,
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
                <Bar
                  dataKey='completed'
                  fill='var(--primary)'
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
