import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Activity } from 'lucide-react'
import { useDoctors } from '@/data/hooks'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_public/doctors/$doctorId')({
  component: DoctorDetailPage,
})

function DoctorDetailPage() {
  const { doctorId } = Route.useParams()
  const doctorsQuery = useDoctors()
  const doctor = (doctorsQuery.data ?? []).find((d) => d.id === doctorId)

  if (doctorsQuery.isPending) {
    return (
      <div className='mx-auto max-w-6xl px-4 py-24 text-center'>
        <p className='text-muted-foreground'>Loading doctor profile...</p>
      </div>
    )
  }

  if (!doctor) {
    return (
      <div className='mx-auto max-w-6xl px-4 py-24 text-center'>
        <h1 className='font-manrope text-2xl font-bold tracking-tight'>
          Doctor not found
        </h1>
        <p className='mt-2 text-muted-foreground'>
          The doctor you&rsquo;re looking for doesn&rsquo;t exist.
        </p>
        <Button asChild className='mt-6'>
          <Link to='/doctors'>
            <ArrowLeft />
            Back to Doctors
          </Link>
        </Button>
      </div>
    )
  }

  const initials = doctor.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className='pb-24'>
      <section className='bg-muted/40 py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <Link
            to='/doctors'
            className='inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground mb-8'
          >
            <ArrowLeft className='size-4' />
            All Doctors
          </Link>

          <div className='flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 shadow-sm max-w-md mx-auto text-center'>
            <span className='flex size-20 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary'>
              {initials}
            </span>
            <div>
              <h1 className='font-manrope text-2xl font-bold tracking-tight'>
                {doctor.name}
              </h1>
              <p className='mt-1 text-muted-foreground'>
                {doctor.specialization}
              </p>
            </div>
            <span className='inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary'>
              <Activity className='size-3.5' />
              {doctor.status === 'active' ? 'Active' : 'Away'}
            </span>
            <div className='flex gap-3 w-full'>
              <Button asChild className='flex-1'>
                <Link to='/book'>Book Appointment</Link>
              </Button>
              <Button variant='outline' asChild className='flex-1'>
                <Link to='/doctors'>
                  <ArrowLeft />
                  Back
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
