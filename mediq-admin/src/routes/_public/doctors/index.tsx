import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Search,
  SearchX,
  Stethoscope,
  Users,
  UserCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDoctors } from '@/data/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_public/doctors/')({
  component: DoctorsPage,
})

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function uniqueSpecializations(all: { specialization: string }[]) {
  const set = new Set(all.map((d) => d.specialization))
  return Array.from(set).sort()
}

function specCount(all: { specialization: string }[], spec: string) {
  return all.filter((d) => d.specialization === spec).length
}

/* -------------------------------------------------------------------------- */
/*  Stat Chips (Hero)                                                          */
/* -------------------------------------------------------------------------- */

function StatChip({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: number | string
  label: string
}) {
  return (
    <span className='inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm'>
      <Icon className='size-4 text-primary' />
      <span className='font-semibold'>{value}</span>
      <span className='text-muted-foreground'>{label}</span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Doctor Card                                                                */
/* -------------------------------------------------------------------------- */

function DoctorCard({
  id,
  name,
  specialization,
  status,
  todayAppointments,
}: {
  id: string
  name: string
  specialization: string
  status: 'active' | 'away'
  todayAppointments: number
}) {
  const initials = initialsOf(name)
  const isAway = status === 'away'

  return (
    <div className='flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-sm'>
      {/* Top row: flat avatar + minimal status dot */}
      <div className='flex items-center justify-between'>
        <span className='flex size-11 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground'>
          {initials}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
            isAway
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
          }`}
        >
          <span className={`size-1.5 rounded-full ${isAway ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {isAway ? 'Away' : 'Available'}
        </span>
      </div>

      {/* Name + specialization as quiet text */}
      <div className='mt-5'>
        <p className='font-manrope text-base font-semibold tracking-tight'>
          {name}
        </p>
        <p className='mt-0.5 text-sm text-muted-foreground'>
          {specialization}
        </p>
      </div>

      {/* One quiet meta line */}
      <p className='mt-2 text-xs text-muted-foreground'>
        {todayAppointments} appointments today
      </p>

      {/* Footer: quiet text link + single primary button */}
      <div className='mt-auto flex items-center justify-between pt-5'>
        <Link
          to='/doctors/$doctorId'
          params={{ doctorId: id }}
          className='text-sm font-medium text-primary hover:underline'
        >
          View profile
        </Link>
        <Button size='sm' asChild>
          <Link to='/book'>Book</Link>
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Loading Skeletons                                                          */
/* -------------------------------------------------------------------------- */

function CardSkeleton() {
  return (
    <div className='flex flex-col rounded-2xl border border-border bg-card p-6'>
      <div className='flex items-center justify-between'>
        <Skeleton className='size-11 rounded-full' />
        <Skeleton className='h-6 w-20 rounded-full' />
      </div>
      <div className='mt-5 space-y-1.5'>
        <Skeleton className='h-4 w-28' />
        <Skeleton className='h-3.5 w-24' />
      </div>
      <Skeleton className='mt-2 h-3 w-20' />
      <div className='mt-auto flex items-center justify-between pt-5'>
        <Skeleton className='h-4 w-20' />
        <Skeleton className='h-8 w-16 rounded-md' />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty State                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className='flex flex-col items-center justify-center py-24 text-center'>
      <div className='flex size-16 items-center justify-center rounded-full bg-muted'>
        <SearchX className='size-7 text-muted-foreground' />
      </div>
      <h3 className='mt-4 font-manrope text-lg font-semibold'>
        No doctors found
      </h3>
      <p className='mt-1 text-sm text-muted-foreground'>
        Try a different search or specialty filter.
      </p>
      <Button variant='outline' size='sm' className='mt-4' onClick={onClear}>
        Clear filters
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

function DoctorsPage() {
  const [search, setSearch] = useState('')
  const [activeSpec, setActiveSpec] = useState<string | null>(null)
  const doctorsQuery = useDoctors()
  const allDoctors = useMemo(() => doctorsQuery.data ?? [], [doctorsQuery.data])

  const specializations = useMemo(
    () => uniqueSpecializations(allDoctors),
    [allDoctors]
  )

  const totalDoctors = allDoctors.length
  const activeDoctors = allDoctors.filter((d) => d.status === 'active').length

  const doctors = useMemo(() => {
    return allDoctors.filter((d) => {
      // Specialty filter
      if (activeSpec && d.specialization !== activeSpec) return false
      // Search filter
      if (search) {
        const q = search.toLowerCase()
        return (
          d.name.toLowerCase().includes(q) ||
          d.specialization.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allDoctors, activeSpec, search])

  function clearFilters() {
    setSearch('')
    setActiveSpec(null)
  }

  return (
    <div className='pb-24'>
      {/* ---- Hero Header ---- */}
      <section className='bg-muted/40 py-20 text-center'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <h1 className='font-manrope text-4xl font-bold tracking-tight mb-4 sm:text-5xl'>
            Our Expert Doctors
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground'>
            Meet our team of highly qualified medical professionals dedicated to
            your well-being.
          </p>
          {/* Stats row */}
          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <StatChip icon={Users} value={totalDoctors} label='doctors' />
            <StatChip icon={UserCheck} value={activeDoctors} label='active now' />
            <StatChip
              icon={Stethoscope}
              value={specializations.length}
              label='specializations'
            />
          </div>
        </div>
      </section>

      {/* ---- Toolbar ---- */}
      <div className='mx-auto max-w-6xl px-4 sm:px-6 -mt-8'>
        {/* Specialty filter chips */}
        <div className='mx-auto max-w-3xl mb-6 flex flex-wrap items-center justify-center gap-2'>
          <button
            onClick={() => setActiveSpec(null)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              activeSpec === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border hover:bg-accent/50'
            }`}
          >
            All
            <span
              className={`rounded-full px-1.5 text-xs ${
                activeSpec === null
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {totalDoctors}
            </span>
          </button>
          {specializations.map((spec) => {
            const count = specCount(allDoctors, spec)
            const isActive = activeSpec === spec
            return (
              <button
                key={spec}
                onClick={() => setActiveSpec(isActive ? null : spec)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border hover:bg-accent/50'
                }`}
              >
                {spec}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search input */}
        <div className='mx-auto max-w-3xl mb-12'>
          <div className='relative'>
            <Search className='absolute left-5 top-1/2 -translate-y-1/2 size-6 text-muted-foreground' />
            <Input
              placeholder='Search by name or specialization...'
              className='pl-14 py-5 text-base rounded-xl bg-card shadow-sm border-border'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ---- Content ---- */}
        {doctorsQuery.isPending ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : doctors.length > 0 ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {doctors.map((doc) => (
              <DoctorCard
                key={doc.id}
                id={doc.id}
                name={doc.name}
                specialization={doc.specialization}
                status={doc.status}
                todayAppointments={doc.todayAppointments}
              />
            ))}
          </div>
        ) : (
          <EmptyState onClear={clearFilters} />
        )}
      </div>
    </div>
  )
}
