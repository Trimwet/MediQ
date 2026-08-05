import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  CalendarDays,
  Users,
  CheckCircle2,
  Stethoscope,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { RecentCheckIns } from './components/recent-check-ins'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export function Dashboard() {
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <p className='text-sm text-muted-foreground'>Today's overview</p>
          </div>
        </div>
        <Tabs
          orientation='vertical'
          defaultValue='overview'
          className='space-y-4'
        >
          <div className='w-full overflow-x-auto pb-2'>
            <TabsList>
              <TabsTrigger value='overview'>Overview</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value='overview' className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              {statCards.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className='pt-6'>
                    <div className='flex items-center gap-2'>
                      <stat.icon className='h-4 w-4 text-primary' />
                      <p className='text-sm text-muted-foreground'>
                        {stat.label}
                      </p>
                    </div>
                    <p className='mt-1 text-3xl font-bold tracking-tight'>
                      {stat.value}
                    </p>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {stat.subtext}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle>Appointments Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <AppointmentsChart />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Recent Check-ins</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentCheckIns />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

const statCards = [
  { label: 'Appointments', value: '24', subtext: '+3 from yesterday', icon: CalendarDays },
  { label: 'In Queue', value: '8', subtext: '3 waiting > 15 min', icon: Users },
  { label: 'Completed', value: '12', subtext: '50% completion rate', icon: CheckCircle2 },
  { label: 'Active Doctors', value: '6 / 8', subtext: 'out of 8 total', icon: Stethoscope },
]

const hourlyData = [
  { hour: '9AM', appointments: 3 },
  { hour: '10AM', appointments: 5 },
  { hour: '11AM', appointments: 7 },
  { hour: '12PM', appointments: 4 },
  { hour: '1PM', appointments: 6 },
  { hour: '2PM', appointments: 8 },
  { hour: '3PM', appointments: 5 },
  { hour: '4PM', appointments: 3 },
  { hour: '5PM', appointments: 1 },
]

function AppointmentsChart() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    // Skeleton that mimics the bar chart shape
    return (
      <div className='flex h-64 w-full items-end justify-between gap-2' aria-label='Loading chart'>
        {hourlyData.map((d) => (
          <Skeleton
            key={d.hour}
            className='w-full animate-pulse rounded-t-md'
            style={{ height: `${d.appointments * 10}%` }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className='h-64 w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={hourlyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis
            dataKey='hour'
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 12 }}
            stroke='var(--muted-foreground)'
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
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
          />
          <Bar
            dataKey='appointments'
            className='fill-primary'
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: '/admin/dashboard',
    isActive: true,
    disabled: false,
  },
  {
    title: 'Appointments',
    href: '/admin/appointments',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Queue',
    href: '/admin/queue',
    isActive: false,
    disabled: false,
  },
  {
    title: 'Reports',
    href: '/admin/reports',
    isActive: false,
    disabled: true,
  },
]
