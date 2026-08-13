import { Link } from '@tanstack/react-router'
import {
  Activity,
  BellRing,
  CalendarCheck,
  HeartPulse,
  LineChart,
  MessageSquare,
  QrCode,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDoctors } from '@/data/hooks'
import { departments } from '@/data/landing/departments'

/* -------------------------------------------------------------------------- */
/*  Hero + Stats strip                                                         */
/* -------------------------------------------------------------------------- */

const heroStats = [
  { value: '12k+', label: 'Appointments booked' },
  { value: '3 min', label: 'Average booking time' },
  { value: '5+', label: 'Active doctors' },
  { value: '100%', label: 'Queue transparency' },
]

function Hero() {
  return (
    <section className='relative isolate'>
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-cover bg-center'
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1758654860024-9e352f70d1f9?q=80&w=1600&auto=format&fit=crop')",
        }}
      />
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-slate-950/70 dark:bg-slate-950/80'
      />
      <div className='mx-auto flex max-w-6xl flex-col items-center px-4 pt-24 pb-32 text-center sm:px-6 sm:pt-32'>
        <h1 className='font-manrope max-w-2xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl'>
          End Wait-Time Uncertainty in Healthcare
        </h1>
        <p className='mt-4 max-w-2xl text-base text-slate-200 sm:text-lg'>
          Provide real-time queue visibility for patients, streamline operations
          for staff, and improve overall satisfaction with our clinical
          management platform.
        </p>
        <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
          <Button size='lg' asChild>
            <Link to='/book'>
              <CalendarCheck />
              Book an appointment
            </Link>
          </Button>
          <Button
            size='lg'
            variant='outline'
            className='border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white'
            asChild
          >
            <Link to='/sign-up'>Create an account</Link>
          </Button>
        </div>
        <p className='mt-6 text-sm text-slate-300'>
          No sign-up needed to book — just pick a doctor and a time.
        </p>
      </div>

      {/* Stats strip */}
      <div className='absolute bottom-0 left-0 right-0 border-t border-white/20 bg-white/10 backdrop-blur-lg'>
        <div className='mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-6 text-center md:grid-cols-4 sm:px-6'>
          {heroStats.map((stat) => (
            <div key={stat.label} className='flex flex-col items-center'>
              <span className='text-2xl font-bold text-white sm:text-3xl'>
                {stat.value}
              </span>
              <span className='mt-1 text-xs font-semibold uppercase tracking-wider text-white/80 sm:text-sm'>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Shared components                                                          */
/* -------------------------------------------------------------------------- */

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof User
  title: string
  description: string
}) {
  return (
    <div className='flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/40'>
      <span className='flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary'>
        <Icon className='size-5' />
      </span>
      <div>
        <h3 className='font-manrope text-lg font-semibold tracking-tight'>
          {title}
        </h3>
        <p className='mt-1.5 text-sm leading-relaxed text-muted-foreground'>
          {description}
        </p>
      </div>
    </div>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className='mx-auto max-w-2xl text-center'>
      <h2 className='font-manrope text-2xl font-bold tracking-tight sm:text-3xl'>
        {title}
      </h2>
      <p className='mt-2 text-sm text-muted-foreground sm:text-base'>
        {description}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Who it is for — 4 cards                                                    */
/* -------------------------------------------------------------------------- */

function UnifiedPlatform() {
  return (
    <section id='platform' className='bg-muted/40 py-16 sm:py-20'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <SectionHeading
          title='A unified platform'
          description='One system that works for everyone in the clinic — patients, front desk, management, and administrators.'
        />
        <div className='mt-10 grid gap-5 sm:grid-cols-2 md:grid-cols-4'>
          <FeatureCard
            icon={User}
            title='For patients'
            description='Book appointments seamlessly and track live queue status from any device, reducing waiting-room anxiety.'
          />
          <FeatureCard
            icon={MessageSquare}
            title='For front desk'
            description='Manage walk-ins and appointments from a single live dashboard. Communicate delays instantly to waiting patients.'
          />
          <FeatureCard
            icon={LineChart}
            title='For hospitals'
            description='Onboard staff quickly, monitor clinic efficiency metrics, and ensure a consistent experience across departments.'
          />
          <FeatureCard
            icon={Activity}
            title='For administrators'
            description='Access real-time analytics, export reports, and make data-driven decisions to optimise clinic operations.'
          />
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  How it works — 3 steps                                                     */
/* -------------------------------------------------------------------------- */

function Step({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof User
  title: string
  description: string
}) {
  return (
    <div className='flex flex-col items-center text-center'>
      <span className='flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20'>
        <Icon className='size-6' />
      </span>
      <h3 className='font-manrope mt-5 text-lg font-semibold tracking-tight'>
        {title}
      </h3>
      <p className='mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground'>
        {description}
      </p>
    </div>
  )
}

function HowItWorks() {
  return (
    <section id='how' className='py-16 sm:py-20'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <SectionHeading
          title='How it works'
          description='From booking to care — three steps, no uncertainty.'
        />
        <div className='mt-12 grid gap-10 md:grid-cols-3'>
          <Step
            icon={CalendarCheck}
            title='Step 1: Book or check in'
            description='Book an appointment online in under a minute, or check in at the facility with a QR code.'
          />
          <Step
            icon={QrCode}
            title='Step 2: Track in real time'
            description='Monitor the live queue and your estimated wait time directly from your phone.'
          />
          <Step
            icon={BellRing}
            title='Step 3: Receive care'
            description='Get called in precisely when it is your turn — no more waiting-room guesswork.'
          />
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Departments — 6 image cards + "View all"                                  */
/* -------------------------------------------------------------------------- */

function DepartmentsSection() {
  return (
    <section className='bg-muted/40 py-16 sm:py-20'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <SectionHeading
          title='Specialists In'
          description='Explore our specialized medical experts equipped with advanced care.'
        />
        <div className='mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5'>
          {departments.slice(0, 6).map((dept) => (
            <Link
              key={dept.id}
              to='/departments/$id'
              params={{ id: dept.id }}
              className='group h-full'
            >
              <div className='h-full flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40'>
                <div className='h-40 overflow-hidden'>
                  <img
                    src={dept.image}
                    alt={dept.title}
                    className='size-full object-cover transition-transform duration-500 group-hover:scale-105'
                    referrerPolicy='no-referrer'
                  />
                </div>
                <div className='p-4 flex flex-col flex-1'>
                  <h3 className='font-manrope text-base font-semibold tracking-tight'>
                    {dept.title}
                  </h3>
                  <p className='mt-1 text-sm text-muted-foreground line-clamp-2'>
                    {dept.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className='mt-10 text-center'>
          <Button asChild>
            <Link to='/departments'>View All Departments</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Meet our doctors                                                           */
/* -------------------------------------------------------------------------- */

function DoctorCard({ name, specialization }: { name: string; specialization: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className='flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm'>
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

function DoctorsSection() {
  const doctorsQuery = useDoctors()
  const doctors = (doctorsQuery.data ?? []).filter((d) => d.status === 'active').slice(0, 4)

  return (
    <section className='py-16 sm:py-20'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <SectionHeading
          title='Meet our doctors'
          description='Experienced professionals ready to provide quality care.'
        />
        <div className='mt-10 grid gap-5 sm:grid-cols-2 md:grid-cols-4'>
          {doctorsQuery.isPending
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className='flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 shadow-sm'
                >
                  <Skeleton className='size-14 rounded-full' />
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-3 w-16' />
                </div>
              ))
            : doctors.map((doc) => (
                <DoctorCard
                  key={doc.id}
                  name={doc.name}
                  specialization={doc.specialization}
                />
              ))}
          {!doctorsQuery.isPending && doctors.length === 0 && (
            <p className='col-span-full text-center text-sm text-muted-foreground'>
              No doctors available right now.
            </p>
          )}
        </div>
        <div className='mt-10 text-center'>
          <Button variant='outline' asChild>
            <Link to='/doctors'>View All Doctors</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Testimonials — CSS marquee                                                 */
/* -------------------------------------------------------------------------- */

const testimonials = [
  {
    quote:
      'MediQ has completely transformed how we handle our morning rush. The interface is intuitive and the support is top-notch.',
    initials: 'SC',
    name: 'Dr. Sarah Chen',
    role: 'Chief of Medicine',
  },
  {
    quote:
      'I no longer have to sit in a crowded waiting room for hours. Being able to track my place in line from my phone is a game changer.',
    initials: 'JW',
    name: 'James Wilson',
    role: 'Patient',
  },
  {
    quote:
      'MediQ has eased my work as a desk clerk. Rather than arguing with patients about their place in line, I monitor the live queue and add others to it.',
    initials: 'MK',
    name: 'Maria Kostas',
    role: 'Clinic Administrator',
  },
  {
    quote:
      'The real-time notifications keep patients informed and reduce no-shows significantly. Best investment our clinic has made.',
    initials: 'LP',
    name: 'Dr. Luis Pereira',
    role: 'General Practitioner',
  },
]

function TestimonialCard({
  quote,
  initials,
  name,
  role,
}: {
  quote: string
  initials: string
  name: string
  role: string
}) {
  return (
    <figure className='flex w-[320px] shrink-0 flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm'>
      <blockquote className='text-sm leading-relaxed text-muted-foreground'>
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className='mt-6 flex items-center gap-3'>
        <span className='flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary'>
          {initials}
        </span>
        <div>
          <div className='text-sm font-semibold'>{name}</div>
          <div className='text-xs text-muted-foreground'>{role}</div>
        </div>
      </figcaption>
    </figure>
  )
}

const marqueeItems = [...testimonials, ...testimonials]

function Testimonials() {
  return (
    <section id='stories' className='py-16 sm:py-20'>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <SectionHeading
          title='What our users say'
          description='Real feedback from healthcare providers and patients.'
        />
      </div>
      <div className='mt-10 overflow-hidden'>
        <div
          className='animate-marquee flex gap-5'
          style={{ animation: 'marquee 30s linear infinite', width: 'max-content' }}
        >
          {marqueeItems.map((t, i) => (
            <TestimonialCard key={i} {...t} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  CTA banner                                                                 */
/* -------------------------------------------------------------------------- */

function CTA() {
  return (
    <section className='bg-muted/40 py-20 sm:py-24'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <div className='relative overflow-hidden rounded-2xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12'>
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,color-mix(in_oklab,white_25%,transparent)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]'
          />
          <div className='relative'>
            <h2 className='font-manrope text-2xl font-bold tracking-tight sm:text-3xl'>
              Ready to book your visit?
            </h2>
            <p className='mx-auto mt-3 max-w-xl text-sm text-primary-foreground/85 sm:text-base'>
              Skip the waiting room. Book an appointment online and track your
              place in line — no account required.
            </p>
            <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
              <Button
                size='lg'
                variant='secondary'
                className='bg-background text-foreground hover:bg-background/90'
                asChild
              >
                <Link to='/book'>
                  <HeartPulse />
                  Book an appointment
                </Link>
              </Button>
              <Button
                size='lg'
                variant='outline'
                className='border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground'
                asChild
              >
                <Link to='/sign-up'>Join as a clinic</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                        */
/* -------------------------------------------------------------------------- */

export function Landing() {
  return (
    <>
      <Hero />
      <UnifiedPlatform />
      <HowItWorks />
      <DepartmentsSection />
      <DoctorsSection />
      <Testimonials />
      <CTA />
    </>
  )
}
