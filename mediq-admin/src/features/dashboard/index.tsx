import { useMemo, useState } from 'react'
import {
  eachDayOfInterval,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  subDays,
} from 'date-fns'
import {
  useAnalytics,
  useAppointments,
  useDoctors,
  useQueue,
} from '@/data/hooks'
import {
  CalendarDays,
  Users,
  CheckCircle2,
  Stethoscope,
  Activity,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { HeaderNav } from '@/components/layout/header-nav'
import { Main } from '@/components/layout/main'
import { NotificationBell } from '@/components/notification-bell'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { confirmedStatuses } from '@/features/appointments/schema'
import { minutesBetween } from '@/features/queue/data'
import { queueStatusBadge, type QueueEntry } from '@/features/queue/schema'
import { AnalyticsCards } from './components/analytics-cards'
import { AppointmentsTrendChart } from './components/appointments-trend-chart'
import { StatusDonut } from './components/status-donut'
import { DoctorUtilizationChart } from './components/doctor-utilization-chart'
import {
  DashboardDateRange,
  type DashboardRange,
} from './components/date-range'
import { DoctorToday } from './components/doctor-today'

const HOURS = ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM']

export function Dashboard() {
  const user = useAuthStore((state) => state.auth.user)
  const appointmentsQuery = useAppointments()
  const queueQuery = useQueue()
  const doctorsQuery = useDoctors()

  const [range, setRange] = useState<DashboardRange>('today')
  const [customFrom, setCustomFrom] = useState<Date>()
  const [customTo, setCustomTo] = useState<Date>()

  // Map 'custom' to '30d' as the widest pre-built bucket; the client
  // then filters the returned data client-side by the custom date bounds.
  const analyticsRange = range === 'custom' ? '30d' : range
  const analyticsQuery = useAnalytics(analyticsRange)

  const isPending =
    appointmentsQuery.isPending ||
    queueQuery.isPending ||
    doctorsQuery.isPending

  const appointments = appointmentsQuery.data ?? []
  const queue = queueQuery.data ?? []
  const doctors = doctorsQuery.data ?? []

  /**
   * Doctor view is scoped to their own work: appointments and queue entries
   * matching the doctor account tied to their email. A real backend must
   * enforce this server-side (types/domain.ts); this is the UI mirror.
   */
  const isDoctor = user?.role.includes('doctor')
  const doctor = isDoctor
    ? doctors.find((d) => d.email?.toLowerCase() === user?.email?.toLowerCase())
    : undefined
  const ownAppointments = useMemo(
    () =>
      doctor
        ? appointments.filter((a) => a.doctorId === doctor.id)
        : appointments,
    [appointments, doctor]
  )

  const bounds = useMemo(() => {
    const now = new Date()
    if (range === 'custom') {
      if (!customFrom || !customTo) {
        return { start: startOfDay(now), end: endOfDay(now), label: 'today' }
      }
      let start = startOfDay(customFrom)
      let end = endOfDay(customTo)
      if (start.getTime() > end.getTime()) {
        ;[start, end] = [end, start]
      }
      return {
        start,
        end,
        label: `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`,
      }
    }
    if (range === '7d') {
      return {
        start: startOfDay(subDays(now, 6)),
        end: endOfDay(now),
        label: 'last 7 days',
      }
    }
    if (range === '30d') {
      return {
        start: startOfDay(subDays(now, 29)),
        end: endOfDay(now),
        label: 'last 30 days',
      }
    }
    return { start: startOfDay(now), end: endOfDay(now), label: 'today' }
  }, [range, customFrom, customTo])

  const inRangeAppointments = useMemo(() => {
    const start = bounds.start.getTime()
    const end = bounds.end.getTime()
    // Pending requests and rejected ones are not confirmed appointments yet.
    return ownAppointments.filter((appointment) => {
      if (!confirmedStatuses.includes(appointment.status)) return false
      const time = new Date(appointment.scheduledFor).getTime()
      return time >= start && time <= end
    })
  }, [ownAppointments, bounds])

  const nowIso = new Date().toISOString()
  const waitingCount = queue.filter((e) => e.status === 'waiting').length
  const servedCount = queue.filter((e) => e.status === 'done').length
  const slowWaiting = queue.filter(
    (e) => e.status === 'waiting' && minutesBetween(e.checkedInAt, nowIso) > 15
  ).length
  const activeDoctors = doctors.filter((d) => d.status === 'active').length
  const completedToday = inRangeAppointments.filter(
    (a) => a.status === 'completed'
  ).length
  const inProgress = inRangeAppointments.filter(
    (a) => a.status === 'in_progress'
  ).length
  const myWaiting = queue.filter(
    (e) => e.status === 'waiting' && e.doctorName === doctor?.name
  ).length

  const stats = doctor
    ? [
        {
          label: 'My appointments',
          value: inRangeAppointments.length,
          subtext: bounds.label,
          icon: CalendarDays,
        },
        {
          label: 'Waiting for me',
          value: myWaiting,
          subtext: 'patients in the queue',
          icon: Users,
        },
        {
          label: 'In progress',
          value: inProgress,
          subtext: 'visits right now',
          icon: Activity,
        },
        {
          label: 'Completed',
          value: completedToday,
          subtext: 'in this period',
          icon: CheckCircle2,
        },
      ]
    : [
        {
          label: 'Appointments',
          value: inRangeAppointments.length,
          subtext: bounds.label,
          icon: CalendarDays,
        },
        {
          label: 'In queue',
          value: waitingCount,
          subtext: `${slowWaiting} waiting > 15 min`,
          icon: Users,
        },
        {
          label: 'Served',
          value: servedCount,
          subtext: 'check-ins completed',
          icon: CheckCircle2,
        },
        {
          label: 'Active doctors',
          value: `${activeDoctors} / ${doctors.length}`,
          subtext: 'on duty now',
          icon: Stethoscope,
        },
      ]

  const chartData = useMemo(() => {
    if (range === 'today') {
      return HOURS.map((hour, index) => ({
        label: hour,
        appointments: inRangeAppointments.filter(
          (a) => new Date(a.scheduledFor).getHours() === 9 + index
        ).length,
      }))
    }
    return eachDayOfInterval({
      start: bounds.start,
      end: bounds.end,
    }).map((day) => ({
      label: format(day, 'MMM d'),
      appointments: inRangeAppointments.filter((a) =>
        isSameDay(new Date(a.scheduledFor), day)
      ).length,
    }))
  }, [range, inRangeAppointments, bounds])

  const recentCheckIns = useMemo(() => {
    const start = bounds.start.getTime()
    const end = bounds.end.getTime()
    return queue
      .filter((entry) => entry.status !== 'left')
      .filter((entry) => {
        const time = new Date(entry.checkedInAt).getTime()
        return time >= start && time <= end
      })
      .sort(
        (a, b) =>
          new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime()
      )
      .slice(0, 5)
  }, [queue, bounds])

  function handleRangeChange(next: DashboardRange) {
    setRange(next)
    if (next === 'custom' && (!customFrom || !customTo)) {
      const today = new Date()
      setCustomFrom(startOfDay(subDays(today, 6)))
      setCustomTo(endOfDay(today))
    }
  }

  return (
    <>
      <Header>
        <HeaderNav active='overview' />
        <Search />
        <div className='ms-auto flex items-center gap-3 sm:gap-4'>
          <NotificationBell />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='mb-2 flex flex-wrap items-end justify-between gap-3'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <p className='text-sm text-muted-foreground'>Today's overview</p>
          </div>
          <DashboardDateRange
            range={range}
            onRangeChange={handleRangeChange}
            from={customFrom}
            to={customTo}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
          />
        </div>

        {isPending ? (
          <DashboardSkeleton />
        ) : isDoctor ? (
          doctor ? (
            <DoctorToday
              appointments={appointments}
              queue={queue}
              doctorName={doctor.name}
            />
          ) : (
            <Card>
              <CardContent className='py-8 text-center'>
                <p className='text-sm text-muted-foreground'>No doctor profile linked to this account.</p>
              </CardContent>
            </Card>
          )
        ) : (
          <div className='space-y-4'>
            {/* Analytics KPI Cards */}
            <AnalyticsCards
              data={analyticsQuery.data}
              isLoading={analyticsQuery.isLoading}
              range={range}
            />

            {/* Analytics Charts */}
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
              <div className='lg:col-span-2'>
                <AppointmentsTrendChart
                  data={analyticsQuery.data?.trend}
                  isLoading={analyticsQuery.isLoading}
                  title={
                    range === 'today' ? "Today's Trend" :
                    range === '7d' ? '7-Day Trend' :
                    range === '30d' ? '30-Day Trend' :
                    `${format(customFrom ?? new Date(), 'MMM d')} – ${format(customTo ?? new Date(), 'MMM d')} Trend`
                  }
                />
              </div>
              <StatusDonut
                data={analyticsQuery.data?.byStatus}
                isLoading={analyticsQuery.isLoading}
              />
              <DoctorUtilizationChart
                data={analyticsQuery.data?.byDoctor}
                isLoading={analyticsQuery.isLoading}
              />
            </div>

            {/* Existing dashboard stats */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
              {stats.map((stat) => (
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
                  <CardTitle>
                    Appointments
                    <span className='ms-2 text-sm font-normal text-muted-foreground'>
                      {bounds.label}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='h-64 w-full'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <LineChart
                        data={chartData}
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
                          dataKey='label'
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
                        <Line
                          type='monotone'
                          dataKey='appointments'
                          stroke='var(--primary)'
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{
                            r: 4,
                            stroke: 'var(--background)',
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Check-ins</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentCheckIns.length === 0 ? (
                    <p className='py-10 text-center text-sm text-muted-foreground'>
                      No check-ins in this period.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patient</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead className='hidden sm:table-cell'>
                            Doctor
                          </TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentCheckIns.map((entry) => (
                          <CheckInRow key={entry.id} entry={entry} />
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Main>
    </>
  )
}

function CheckInRow({ entry }: { entry: QueueEntry }) {
  return (
    <TableRow>
      <TableCell className='font-medium'>{entry.patientName}</TableCell>
      <TableCell className='text-muted-foreground'>
        {new Date(entry.checkedInAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </TableCell>
      <TableCell className='hidden text-muted-foreground sm:table-cell'>
        {entry.doctorName}
      </TableCell>
      <TableCell>
        <Badge variant='outline' className={queueStatusBadge[entry.status]}>
          {entry.status.replace('_', ' ')}
        </Badge>
      </TableCell>
    </TableRow>
  )
}

function DashboardSkeleton() {
  return (
    <div className='space-y-4' aria-label='Loading dashboard'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className='space-y-2 pt-6'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-8 w-16' />
              <Skeleton className='h-3 w-20' />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <Card>
          <CardContent className='space-y-2 pt-6'>
            <Skeleton className='h-4 w-40' />
            <Skeleton className='h-52 w-full' />
          </CardContent>
        </Card>
        <Card>
          <CardContent className='space-y-3 pt-6'>
            <Skeleton className='h-4 w-40' />
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className='h-8 w-full' />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
