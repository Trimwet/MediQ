import { createFileRoute, Link } from '@tanstack/react-router'
import { Activity, Search } from 'lucide-react'
import { useState } from 'react'
import { useDoctors } from '@/data/hooks'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/_public/doctors/')({
  component: DoctorsPage,
})

function DoctorCard({ name, specialization }: { name: string; specialization: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className='flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm transition-all hover:shadow-md hover:border-primary/40'>
      <span className='flex size-14 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary'>
        {initials}
      </span>
      <div>
        <p className='font-manrope text-sm font-semibold tracking-tight'>
          {name}
        </p>
        <p className='mt-0.5 text-xs text-muted-foreground'>
          {specialization}
        </p>
      </div>
      <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary'>
        <Activity className='size-3' />
        Active
      </span>
    </div>
  )
}

function DoctorsPage() {
  const [search, setSearch] = useState('')
  const doctorsQuery = useDoctors()
  const doctors = (doctorsQuery.data ?? []).filter((d) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      d.name.toLowerCase().includes(q) ||
      d.specialization.toLowerCase().includes(q)
    )
  })

  return (
    <div className='pb-24'>
      {/* Header */}
      <section className='bg-muted/40 py-24 text-center'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <h1 className='font-manrope text-4xl font-bold tracking-tight mb-6 sm:text-5xl'>
            Our Expert Doctors
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground'>
            Meet our team of highly qualified medical professionals dedicated to
            your well-being.
          </p>
        </div>
      </section>

      <div className='mx-auto max-w-6xl px-4 sm:px-6 -mt-8'>
        {/* Search */}
        <div className='mx-auto max-w-2xl mb-16'>
          <div className='relative'>
            <Search className='absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground' />
            <Input
              placeholder='Search by name or specialization...'
              className='pl-12 py-4 rounded-xl bg-card shadow-lg border-border'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Grid */}
        {doctorsQuery.isPending ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className='flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 shadow-sm'
              >
                <Skeleton className='size-14 rounded-full' />
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-3 w-16' />
              </div>
            ))}
          </div>
        ) : doctors.length > 0 ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {doctors.map((doc) => (
              <Link
                key={doc.id}
                to='/doctors/$doctorId'
                params={{ doctorId: doc.id }}
              >
                <DoctorCard
                  name={doc.name}
                  specialization={doc.specialization}
                />
              </Link>
            ))}
          </div>
        ) : (
          <div className='py-20 text-center'>
            <p className='text-muted-foreground text-lg'>
              No doctors found matching your search.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
