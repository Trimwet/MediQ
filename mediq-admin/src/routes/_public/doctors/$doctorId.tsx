import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Star,
  Mail,
  Activity,
  CalendarClock,
  GraduationCap,
} from 'lucide-react'
import { useDoctors } from '@/data/hooks'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_public/doctors/$doctorId')({
  component: DoctorDetailPage,
})

/* -------------------------------------------------------------------------- */
/*  Deterministic helpers (mirror directory page logic)                        */
/* -------------------------------------------------------------------------- */

function deterministicRating(id: string) {
  return (4.7 + ((id.charCodeAt(id.length - 1) % 3) * 0.1)).toFixed(1)
}

function deterministicReviews(id: string) {
  return 90 + (id.charCodeAt(0) % 11) * 15
}

function deterministicYears(id: string) {
  return 8 + (id.charCodeAt(id.length - 1) % 12)
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/* -------------------------------------------------------------------------- */
/*  Per-specialization content maps                                            */
/* -------------------------------------------------------------------------- */

const bioMap: Record<string, string> = {
  Cardiology:
    'cardiac care and hypertension management',
  Pediatrics:
    'child health and immunisation',
  'General Practice':
    'primary and preventive care',
  Dermatology:
    'skin conditions and cosmetic dermatology',
  Neurology:
    'neurological disorders and migraine care',
  Orthopedics:
    'bone and joint health',
}

const specialtiesMap: Record<string, string[]> = {
  Cardiology: ['Hypertension', 'Heart Failure', 'Preventive Cardiology'],
  Pediatrics: ['Child Immunisation', 'Adolescent Medicine', 'Growth Assessment'],
  'General Practice': ['Preventive Care', 'Chronic Disease Management'],
  Dermatology: ['Acne Treatment', 'Eczema Management', 'Skin Cancer Screening'],
  Neurology: ['Migraine Care', 'Epilepsy Management', 'Stroke Prevention'],
  Orthopedics: ['Sports Injuries', 'Joint Replacement', 'Fracture Care'],
}

function getBio(name: string, specialization: string, id: string) {
  const focus = bioMap[specialization] ?? 'general medical care'
  const years = deterministicYears(id)
  return `${name} is a ${specialization.toLowerCase()} specialist at MediQ General Hospital with ${years} years of clinical experience. He is known for a patient-first approach and evidence-based ${focus}. His practice emphasizes thorough diagnosis, clear communication, and personalised treatment plans tailored to each patient's needs.`
}

function getSpecialties(specialization: string) {
  return [specialization, ...(specialtiesMap[specialization] ?? ['General Consultation', 'Preventive Care'])]
}

function getEducation(id: string, specialization: string, status: string) {
  const uni = id.charCodeAt(id.length - 1) % 3 === 0 ? 'Ibadan' : 'Lagos'
  const entries = [
    { degree: 'MBBS', institution: `University of ${uni}` },
    { degree: 'FWACP', institution: 'West African College of Physicians' },
  ]
  if (status === 'active') {
    entries.push({ degree: `Fellowship: ${specialization}`, institution: 'National Hospital Abuja' })
  } else {
    entries.push({ degree: 'Residency', institution: 'University College Hospital Ibadan' })
  }
  return entries
}

/* -------------------------------------------------------------------------- */
/*  Loading skeleton                                                           */
/* -------------------------------------------------------------------------- */

function ProfileSkeleton() {
  return (
    <div className='pb-24'>
      <section className='bg-muted/40 py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <Skeleton className='mb-8 h-4 w-28 rounded' />
          <div className='rounded-2xl border border-border bg-card p-8 shadow-sm'>
            <div className='flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-center gap-5'>
                <Skeleton className='size-20 rounded-full' />
                <div className='space-y-2'>
                  <Skeleton className='h-6 w-40' />
                  <Skeleton className='h-4 w-28' />
                  <Skeleton className='h-4 w-32' />
                  <Skeleton className='h-4 w-36' />
                </div>
              </div>
              <div className='hidden flex-col items-end gap-3 sm:flex'>
                <Skeleton className='h-3 w-32' />
                <Skeleton className='h-10 w-40 rounded-md' />
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className='mx-auto max-w-6xl px-4 sm:px-6 pt-10'>
        <div className='grid gap-8 lg:grid-cols-3'>
          <div className='space-y-8 lg:col-span-2'>
            <Skeleton className='h-40 rounded-2xl' />
            <Skeleton className='h-64 rounded-2xl' />
            <Skeleton className='h-32 rounded-2xl' />
          </div>
          <div className='space-y-6'>
            <Skeleton className='h-48 rounded-2xl' />
            <Skeleton className='h-36 rounded-2xl' />
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                        */
/* -------------------------------------------------------------------------- */

function DoctorDetailPage() {
  const { doctorId } = Route.useParams()
  const doctorsQuery = useDoctors()
  const doctor = (doctorsQuery.data ?? []).find((d) => d.id === doctorId)

  if (doctorsQuery.isPending) {
    return <ProfileSkeleton />
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

  const isAway = doctor.status === 'away'
  const initials = initialsOf(doctor.name)
  const rating = deterministicRating(doctor.id)
  const reviews = deterministicReviews(doctor.id)
  const bio = getBio(doctor.name, doctor.specialization, doctor.id)
  const specialties = getSpecialties(doctor.specialization)
  const education = getEducation(doctor.id, doctor.specialization, doctor.status)

  return (
    <div className='pb-24'>
      {/* ---- Hero band ---- */}
      <section className='bg-muted/40 py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <Link
            to='/doctors'
            className='inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground mb-8'
          >
            <ArrowLeft className='size-4' />
            All Doctors
          </Link>

          {/* Profile header card */}
          <div className='rounded-2xl border border-border bg-card p-8 shadow-sm'>
            <div className='flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between'>
              {/* Left: avatar + info */}
              <div className='flex items-center gap-5'>
                <span className='flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary'>
                  {initials}
                </span>
                <div>
                  <h1 className='font-manrope text-2xl font-bold tracking-tight'>
                    {doctor.name}
                  </h1>
                  <p className='mt-1 text-muted-foreground'>
                    {doctor.specialization}
                  </p>
                  <div className='mt-2 flex items-center gap-1.5'>
                    <Star className='size-4 fill-amber-400 text-amber-400' />
                    <span className='text-sm font-semibold'>{rating}</span>
                    <span className='text-sm text-muted-foreground'>
                      ({reviews} reviews)
                    </span>
                  </div>
                  <div className='mt-1.5 flex items-center gap-1.5 text-sm'>
                    <span
                      className={`size-1.5 rounded-full ${
                        isAway ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        isAway ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {isAway ? 'Away — next opening tomorrow' : 'Available today'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: CTA (hidden on mobile) */}
              <div className='hidden flex-col items-end gap-3 sm:flex'>
                <p className='text-xs text-muted-foreground'>
                  Next opening:{' '}
                  <span className='font-medium text-foreground'>
                    {isAway ? 'Tomorrow' : 'Today'}
                  </span>
                </p>
                <Button asChild>
                  <Link to='/book'>Book Appointment</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Main grid ---- */}
      <div className='mx-auto max-w-6xl px-4 sm:px-6 pt-10'>
        <div className='grid gap-8 lg:grid-cols-3'>
          {/* Main column */}
          <div className='space-y-8 lg:col-span-2'>
            {/* About */}
            <div className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
              <h2 className='font-manrope text-lg font-bold tracking-tight'>
                About
              </h2>
              <p className='mt-3 text-sm leading-relaxed text-muted-foreground'>
                {bio}
              </p>
            </div>

            {/* Education & Credentials */}
            <div className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
              <h2 className='font-manrope text-lg font-bold tracking-tight'>
                Education &amp; Credentials
              </h2>
              <ul className='mt-3 space-y-3'>
                {education.map((entry) => (
                  <li key={entry.degree} className='flex items-start gap-3'>
                    <GraduationCap className='mt-0.5 size-4 shrink-0 text-primary' />
                    <div>
                      <p className='text-sm font-medium'>{entry.degree}</p>
                      <p className='text-xs text-muted-foreground'>
                        {entry.institution}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Specialisations */}
            <div className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
              <h2 className='font-manrope text-lg font-bold tracking-tight'>
                Specialisations
              </h2>
              <div className='mt-3 flex flex-wrap gap-2'>
                {specialties.map((s) => (
                  <span
                    key={s}
                    className='rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium'
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className='space-y-6'>
            {/* Quick Facts */}
            <div className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
              <h2 className='font-manrope text-base font-bold'>Quick Facts</h2>
              <dl className='mt-4 space-y-4'>
                <div className='flex items-center gap-3'>
                  <Mail className='size-4 shrink-0 text-muted-foreground' />
                  <dt className='flex-1 text-sm text-muted-foreground'>Email</dt>
                  <dd className='text-sm font-medium'>{doctor.email}</dd>
                </div>
                <div className='flex items-center gap-3'>
                  <Activity className='size-4 shrink-0 text-muted-foreground' />
                  <dt className='flex-1 text-sm text-muted-foreground'>Status</dt>
                  <dd className='text-sm font-medium'>
                    {isAway ? 'Away' : 'Available'}
                  </dd>
                </div>
                <div className='flex items-center gap-3'>
                  <CalendarClock className='size-4 shrink-0 text-muted-foreground' />
                  <dt className='flex-1 text-sm text-muted-foreground'>
                    Today&rsquo;s appointments
                  </dt>
                  <dd className='text-sm font-medium'>
                    {doctor.todayAppointments}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Booking card */}
            <div className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
              <p className='text-sm font-medium'>Next opening</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {isAway ? 'Tomorrow' : 'Today'}
              </p>
              <Button asChild className='mt-5 w-full'>
                <Link to='/book'>Book Appointment</Link>
              </Button>
              <Button variant='outline' asChild className='mt-2 w-full'>
                <Link to='/doctors'>View all doctors</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
