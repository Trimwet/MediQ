import { useMemo } from 'react'
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
  Activity,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAuthStore } from '@/stores/auth-store'
import { useAppointments, useDoctors, useQueue } from '@/data/hooks'
import { minutesBetween } from '@/features/queue/data'
import { queueStatusBadge, type QueueEntry } from '@/features/queue/schema'

const HOURS = ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM']

export function Dashboard() {
  const user = useAuthStore((state) => state.auth.user)
  const appointmentsQuery = useAppointments()
  const queueQuery = useQueue()
  const doctorsQuery = useDoctors()

  const isPending =
    appointmentsQuery.isPending || queueQuery.isPending || doctorsQuery.isPending

  const appointments = appointmentsQuery.data ?? []
  const queue = queueQuery.data ?? []
  const doctors = doctorsQuery.data ?? []

  /**
   * Doctor view is scoped to their own work: appointments and queue entries
   * matching the doctor account tied to their email. A real backend must
   * enforce this server-side (types/domain.ts); this is the UI mirror.
   */
  const isDoctor = user?.role.includes('doctor')
  const doctor = isDoctor ? doctors.find((d) => d.email === user?.email) : undefined
  const ownAppointments = useMemo(
    () =>
      doctor
        ? appointments.filter((a) => a.doctorId === doctor.id)
        : appointments,
    [appointments, doctor]
  )

  const now = new Date().toISOString()
  const waitingCount = queue.filter((e) => e.status === 'waiting').length
  const servedCount = queue.filter((e) => e.status === 'done').length
  const slowWaiting = queue.filter(
    (e) => e.status === 'waiting' && minutesBetween(e.checkedInAt, now) > 15
  ).length
  const activeDoctors = doctors.filter((d) => d.status === 'active').length
  const completedToday = ownAppointments.filter(
    (a) => a.status === 'completed'
  ).length
  const inProgress = ownAppointments.filter(
    (a) => a.status === 'in_progress'
  ).length
  const myWaiting = queue.filter(
    (e) => e.status === 'waiting' && e.doctorName === doctor?.name
  ).length

  const stats = doctor
    ? [
        {
          label: 'My appointments',
          value: ownAppointments.length,
          subtext: 'scheduled today',
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
          subtext: 'visits today',
          icon: CheckCircle2,
        },
      ]
    : [
        {
          label: 'Appointments',
          value: appointments.length,
          subtext: 'scheduled today',
          icon: CalendarDays,
        },
        {
          label: 'In queue',
          value: waitingCount,
          subtext: `${slowWaiting} waiting > 15 min`,
          icon: Users,
        },
        {
          label: 'Served today',
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

  const hourlyData = useMemo(
    () =>
      HOURS.map((hour, index) => ({
        hour,
        appointments: ownAppointments.filter(
          (a) => new Date(a.scheduledFor).getHours() === 9 + index
        ).length,
      })),
    [ownAppointments]
  )

  const recentCheckIns = useMemo(
    () =>
      queue
        .filter((entry) => entry.status !== 'left')
        .sort(
          (a, b) =>
            new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime()
        )
        .slice(0, 5),
    [queue]
  )

  return (
    <>
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <Search />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <p className='text-sm text-muted-foreground'>Today's overview</p>
          </div>
        </div>

        {isPending ? (
          <DashboardSkeleton />
        ) : (
          <div className='space-y-4'>
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
                  <CardTitle>Appointments Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='h-64 w-full'>
                    <ResponsiveContainer width='100%' height='100%'>
                      <BarChart
                        data={hourlyData}
                        margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                      >
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
                          labelStyle={{
                            color: 'var(--foreground)',
                            fontWeight: 600,
                          }}
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Check-ins</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentCheckIns.length === 0 ? (
                    <p className='py-10 text-center text-sm text-muted-foreground'>
                      No check-ins yet today.
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
]
