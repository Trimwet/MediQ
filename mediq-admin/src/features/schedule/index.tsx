import { useState, useMemo } from 'react'
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  parseISO,
  getHours,
  setHours,
  setMinutes,
  isToday,
} from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  CalendarPlus,
} from 'lucide-react'
import { useAppointments, useCreateAppointment } from '@/data/hooks'
import { useRbac } from '@/hooks/use-rbac'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderNav } from '@/components/layout/header-nav'
import { NotificationBell } from '@/components/notification-bell'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AppointmentDialog } from '@/features/appointments/components/appointment-dialog'
import { type Appointment, appointmentStatusBadge } from '@/features/appointments/schema'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week' | 'day'

// ── Status colour dots ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-400',
  booked: 'bg-sky-500',
  arrived: 'bg-amber-500',
  in_progress: 'bg-indigo-500',
  completed: 'bg-emerald-500',
  no_show: 'bg-neutral-400',
  cancelled: 'bg-red-400',
  rejected: 'bg-red-400',
}

// ── Tiny appointment pill ─────────────────────────────────────────────────────

function ApptPill({ appt, compact = false }: { appt: Appointment; compact?: boolean }) {
  const dot = STATUS_COLORS[appt.status] ?? 'bg-muted-foreground'
  const time = format(parseISO(appt.scheduledFor), 'h:mm a')

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs leading-tight',
        'bg-primary/8 border border-primary/15 hover:bg-primary/15 transition-colors cursor-default',
        compact && 'truncate'
      )}
      title={`${appt.patientName} · ${appt.doctorName} · ${time}`}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} />
      {compact ? (
        <span className='truncate font-medium'>{appt.patientName}</span>
      ) : (
        <>
          <span className='font-medium truncate'>{appt.patientName}</span>
          <span className='text-muted-foreground shrink-0'>{time}</span>
        </>
      )}
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({ date, appointments }: { date: Date; appointments: Appointment[] }) {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  const gridStart = startOfWeek(start, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(end, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const a of appointments) {
      const key = format(parseISO(a.scheduledFor), 'yyyy-MM-dd')
      const arr = map.get(key) ?? []
      arr.push(a)
      map.set(key, arr)
    }
    return map
  }, [appointments])

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className='flex flex-col flex-1 min-h-0'>
      {/* weekday headers */}
      <div className='grid grid-cols-7 border-b'>
        {weekdays.map((d) => (
          <div key={d} className='py-2 text-center text-xs font-medium text-muted-foreground'>
            {d}
          </div>
        ))}
      </div>
      {/* day cells */}
      <div className='grid grid-cols-7 flex-1 auto-rows-fr'>
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayAppts = byDay.get(key) ?? []
          const isCurrentMonth = isSameMonth(day, date)
          const today = isToday(day)

          return (
            <div
              key={key}
              className={cn(
                'border-b border-r p-1 min-h-[80px] flex flex-col gap-0.5',
                !isCurrentMonth && 'bg-muted/30',
              )}
            >
              <span
                className={cn(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full self-end',
                  today && 'bg-primary text-primary-foreground',
                  !isCurrentMonth && 'text-muted-foreground',
                )}
              >
                {format(day, 'd')}
              </span>
              {dayAppts.slice(0, 3).map((a) => (
                <ApptPill key={a.id} appt={a} compact />
              ))}
              {dayAppts.length > 3 && (
                <span className='text-[10px] text-muted-foreground pl-1'>
                  +{dayAppts.length - 3} more
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function WeekView({ date, appointments }: { date: Date; appointments: Appointment[] }) {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const byDayHour = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const a of appointments) {
      const d = parseISO(a.scheduledFor)
      const key = `${format(d, 'yyyy-MM-dd')}-${getHours(d)}`
      const arr = map.get(key) ?? []
      arr.push(a)
      map.set(key, arr)
    }
    return map
  }, [appointments])

  return (
    <div className='flex flex-col flex-1 min-h-0 overflow-auto'>
      {/* header row */}
      <div className='grid sticky top-0 z-10 bg-background border-b' style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className='py-2 text-center border-l'>
            <div className='text-xs text-muted-foreground'>{format(day, 'EEE')}</div>
            <div className={cn(
              'text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full',
              isToday(day) && 'bg-primary text-primary-foreground',
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>
      {/* time grid */}
      <div className='flex-1'>
        {HOURS.map((hour) => (
          <div
            key={hour}
            className='grid border-b'
            style={{ gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: 48 }}
          >
            <div className='text-[10px] text-muted-foreground text-right pr-2 pt-0.5'>
              {hour === 0 ? '' : format(setMinutes(setHours(new Date(), hour), 0), 'h a')}
            </div>
            {days.map((day) => {
              const key = `${format(day, 'yyyy-MM-dd')}-${hour}`
              const appts = byDayHour.get(key) ?? []
              return (
                <div key={day.toISOString()} className='border-l px-0.5 py-0.5 flex flex-col gap-0.5'>
                  {appts.map((a) => (
                    <ApptPill key={a.id} appt={a} />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ date, appointments }: { date: Date; appointments: Appointment[] }) {
  const dayAppts = useMemo(
    () =>
      appointments
        .filter((a) => isSameDay(parseISO(a.scheduledFor), date))
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    [appointments, date]
  )

  const byHour = useMemo(() => {
    const map = new Map<number, Appointment[]>()
    for (const a of dayAppts) {
      const h = getHours(parseISO(a.scheduledFor))
      const arr = map.get(h) ?? []
      arr.push(a)
      map.set(h, arr)
    }
    return map
  }, [dayAppts])

  return (
    <div className='flex flex-col flex-1 min-h-0 overflow-auto'>
      <div className='sticky top-0 z-10 bg-background border-b py-2 px-4'>
        <div className='text-sm font-medium'>
          {format(date, 'EEEE, MMMM d, yyyy')}
        </div>
        <div className='text-xs text-muted-foreground'>
          {dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div className='flex-1'>
        {HOURS.map((hour) => {
          const appts = byHour.get(hour) ?? []
          return (
            <div key={hour} className='flex border-b min-h-[56px]'>
              <div className='w-14 shrink-0 text-[10px] text-muted-foreground text-right pr-2 pt-1'>
                {hour === 0 ? '' : format(setMinutes(setHours(new Date(), hour), 0), 'h a')}
              </div>
              <div className='flex-1 border-l px-2 py-1 flex flex-col gap-1'>
                {appts.map((a) => (
                  <div
                    key={a.id}
                    className='flex items-start gap-3 rounded-lg border bg-card p-2 hover:bg-accent transition-colors'
                  >
                    <div className={cn('mt-1 size-2 shrink-0 rounded-full', STATUS_COLORS[a.status])} />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <span className='font-medium text-sm'>{a.patientName}</span>
                        <Badge
                          variant='outline'
                          className={cn('text-[10px] px-1.5 py-0', appointmentStatusBadge[a.status])}
                        >
                          {a.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className='text-xs text-muted-foreground mt-0.5'>
                        {format(parseISO(a.scheduledFor), 'h:mm a')} · {a.doctorName}
                        {a.reason && ` · ${a.reason}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Schedule component ───────────────────────────────────────────────────

export function Schedule() {
  const { can } = useRbac()
  const canBook = can('appointments:book')

  const [view, setView] = useState<ViewMode>('week')
  const [date, setDate] = useState(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)

  const appointmentsQuery = useAppointments()
  const createAppointment = useCreateAppointment()
  const appointments = appointmentsQuery.data ?? []

  // Navigate
  function prev() {
    if (view === 'month') setDate((d) => subMonths(d, 1))
    else if (view === 'week') setDate((d) => subWeeks(d, 1))
    else setDate((d) => subDays(d, 1))
  }
  function next() {
    if (view === 'month') setDate((d) => addMonths(d, 1))
    else if (view === 'week') setDate((d) => addWeeks(d, 1))
    else setDate((d) => addDays(d, 1))
  }
  function goToday() { setDate(new Date()) }

  // Title
  const title = useMemo(() => {
    if (view === 'month') return format(date, 'MMMM yyyy')
    if (view === 'week') {
      const ws = startOfWeek(date, { weekStartsOn: 0 })
      const we = endOfWeek(date, { weekStartsOn: 0 })
      return isSameMonth(ws, we)
        ? `${format(ws, 'MMM d')} – ${format(we, 'd, yyyy')}`
        : `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
    }
    return format(date, 'EEEE, MMMM d, yyyy')
  }, [view, date])

  function handleCreated(input: Omit<Appointment, 'id' | 'status'>) {
    createAppointment.mutate(input, {
      onSuccess: (created) =>
        toast.success(`Appointment booked for ${created.patientName}`),
    })
  }

  return (
    <>
      <Header>
        <HeaderNav active='schedule' />
        <Search />
        <NotificationBell />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-0 p-0 overflow-hidden'>
        {/* toolbar */}
        <div className='flex items-center justify-between gap-2 px-4 py-3 border-b flex-wrap'>
          <div className='flex items-center gap-2'>
            <Button variant='outline' size='sm' onClick={goToday}>Today</Button>
            <Button variant='ghost' size='icon' className='size-8' onClick={prev}>
              <ChevronLeft className='size-4' />
            </Button>
            <Button variant='ghost' size='icon' className='size-8' onClick={next}>
              <ChevronRight className='size-4' />
            </Button>
            <h2 className='text-sm font-semibold min-w-[160px]'>{title}</h2>
          </div>

          <div className='flex items-center gap-2'>
            {/* view switcher */}
            <div className='flex items-center rounded-md border p-0.5 gap-0.5'>
              <Button
                variant={view === 'month' ? 'secondary' : 'ghost'}
                size='sm'
                className='h-7 px-2 gap-1.5'
                onClick={() => setView('month')}
              >
                <LayoutGrid className='size-3.5' />
                Month
              </Button>
              <Button
                variant={view === 'week' ? 'secondary' : 'ghost'}
                size='sm'
                className='h-7 px-2 gap-1.5'
                onClick={() => setView('week')}
              >
                <CalendarRange className='size-3.5' />
                Week
              </Button>
              <Button
                variant={view === 'day' ? 'secondary' : 'ghost'}
                size='sm'
                className='h-7 px-2 gap-1.5'
                onClick={() => setView('day')}
              >
                <CalendarDays className='size-3.5' />
                Day
              </Button>
            </div>

            {canBook && (
              <Button size='sm' onClick={() => setDialogOpen(true)}>
                <CalendarPlus className='size-4' />
                New appointment
              </Button>
            )}
          </div>
        </div>

        {/* loading */}
        {appointmentsQuery.isPending && (
          <div className='flex items-center justify-center flex-1 text-sm text-muted-foreground'>
            Loading schedule…
          </div>
        )}

        {/* calendar views */}
        {!appointmentsQuery.isPending && view === 'month' && (
          <MonthView date={date} appointments={appointments} />
        )}
        {!appointmentsQuery.isPending && view === 'week' && (
          <WeekView date={date} appointments={appointments} />
        )}
        {!appointmentsQuery.isPending && view === 'day' && (
          <DayView date={date} appointments={appointments} />
        )}
      </Main>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </>
  )
}
