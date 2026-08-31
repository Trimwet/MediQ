import { Link } from '@tanstack/react-router'
import { ArrowLeft, CalendarDays, Stethoscope, Users } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { ThemeSwitch } from '@/components/theme-switch'
import dashboardDark from './assets/dashboard-dark.png'
import dashboardLight from './assets/dashboard-light.png'

type AuthBackTo = '/' | '/sign-in' | '/sign-up' | '/forgot-password'

type AuthLayoutProps = {
  title: string
  description: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  /** Optional back link rendered above the title. */
  back?: { to: AuthBackTo; label: string; search?: Record<string, unknown> }
}

const features = [
  {
    icon: CalendarDays,
    title: 'Appointments',
    text: 'Your daily schedule at a glance',
  },
  {
    icon: Users,
    title: 'Live queue',
    text: 'Check-ins and wait time in real time',
  },
  {
    icon: Stethoscope,
    title: 'Doctor coverage',
    text: 'See which doctors are active',
  },
]

export function AuthLayout({
  title,
  description,
  children,
  footer,
  back,
}: AuthLayoutProps) {
  return (
    <div className='relative grid min-h-dvh lg:grid-cols-2'>
      <div className='absolute end-4 top-4 z-10'>
        <ThemeSwitch />
      </div>
      <div className='flex flex-col px-6 pt-8 pb-12 sm:px-10 lg:px-16'>
        <Logo className='h-9' />
        <div className='flex flex-1 items-center justify-center py-16'>
          <div className='w-full max-w-sm motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0'>
            {back ? (
              <Link
                to={back.to}
                search={back.search as never}
                className='mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
              >
                <ArrowLeft className='size-4' />
                {back.label}
              </Link>
            ) : null}
            <h1 className='font-manrope text-3xl font-bold tracking-tight'>
              {title}
            </h1>
            <p className='mt-3 text-sm text-muted-foreground'>{description}</p>
            <Card className='mt-8 gap-5'>
              <CardContent>{children}</CardContent>
              {footer ? (
                <CardFooter>
                  <p className='w-full px-2 text-center text-sm text-muted-foreground'>
                    {footer}
                  </p>
                </CardFooter>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
      <AuthVisualPanel />
    </div>
  )
}

function AuthVisualPanel() {
  return (
    <aside className='relative hidden overflow-hidden border-s border-border bg-muted lg:block'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_78%_18%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]' />
      <div className='pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,color-mix(in_oklab,var(--foreground)_8%,transparent)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)] [background-size:22px_22px]' />
      <div className='relative flex h-full flex-col justify-center gap-9 px-12 motion-safe:animate-in motion-safe:duration-700 motion-safe:fade-in-0 xl:px-16'>
        <div className='mx-auto w-full max-w-md overflow-hidden rounded-xl shadow-lg ring-1 shadow-primary/15 ring-border'>
          <img
            src={dashboardLight}
            alt='MediQ dashboard showing appointments and queue overview'
            width={1024}
            height={720}
            className='h-auto w-full dark:hidden'
          />
          <img
            src={dashboardDark}
            alt='MediQ dashboard showing appointments and queue overview'
            width={1024}
            height={720}
            className='hidden h-auto w-full dark:block'
          />
        </div>
        <ul className='mx-auto grid w-full max-w-md gap-3'>
          {features.map((feature) => (
            <li key={feature.title} className='flex items-center gap-3'>
              <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <feature.icon className='size-4' />
              </span>
              <div>
                <p className='text-sm font-medium'>{feature.title}</p>
                <p className='text-sm text-muted-foreground'>{feature.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
