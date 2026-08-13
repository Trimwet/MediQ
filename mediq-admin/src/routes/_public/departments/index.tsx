import { createFileRoute, Link } from '@tanstack/react-router'
import { Phone } from 'lucide-react'
import { departments } from '@/data/landing/departments'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_public/departments/')({
  component: DepartmentsPage,
})

function DepartmentsPage() {
  return (
    <div className='pb-24'>
      {/* Header */}
      <section className='bg-primary/10 py-24 text-center relative overflow-hidden'>
        <div className='absolute inset-0 opacity-10'>
          <div className='absolute size-full bg-[radial-gradient(theme(colors.foreground)_1px,transparent_1px)] [background-size:20px_20px]' />
        </div>
        <div className='relative z-10 mx-auto max-w-6xl px-4'>
          <h1 className='font-manrope text-4xl font-bold tracking-tight mb-4 sm:text-5xl'>
            Our Specialists
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground'>
            Comprehensive medical services across all major specialties.
          </p>
        </div>
      </section>

      {/* Grid */}
      <div className='mx-auto max-w-6xl px-4 py-20'>
        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6'>
          {departments.map((dept) => (
            <Link
              key={dept.id}
              to='/departments/$id'
              params={{ id: dept.id }}
              className='group h-full'
            >
              <div className='h-full flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40'>
                <div className='h-36 overflow-hidden'>
                  <img
                    src={dept.image}
                    alt={dept.title}
                    className='size-full object-cover transition-transform duration-500 group-hover:scale-110'
                    referrerPolicy='no-referrer'
                  />
                </div>
                <div className='p-4 flex flex-col flex-1'>
                  <h3 className='font-manrope text-sm font-semibold tracking-tight'>
                    {dept.title}
                  </h3>
                  <p className='mt-1 text-xs text-muted-foreground line-clamp-2'>
                    {dept.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info Section */}
        <div className='mt-20 overflow-hidden rounded-2xl bg-primary px-8 py-16 text-primary-foreground relative md:p-20'>
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,color-mix(in_oklab,white_25%,transparent)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black,transparent)]'
          />
          <div className='relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center'>
            <div>
              <h2 className='font-manrope text-3xl font-bold tracking-tight mb-6 sm:text-4xl'>
                Can&rsquo;t find what you&rsquo;re looking for?
              </h2>
              <p className='text-lg text-primary-foreground/80 mb-8'>
                We offer many more specialized services.
              </p>
              <div className='flex gap-4 flex-wrap'>
                <Button asChild>
                  <a href='tel:+2348031234567'>
                    <Phone />
                    Call Help Desk
                  </a>
                </Button>
                <Button
                  variant='outline'
                  className='border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground'
                  asChild
                >
                  <Link to='/contact'>Contact Us</Link>
                </Button>
              </div>
            </div>
            <div className='grid grid-cols-2 gap-3'>
              {[
                'Emergency Care',
                'Diagnostic Lab',
                'Pharmacy',
                'Rehabilitation',
                'Health Checkups',
                'Telemedicine',
              ].map((item) => (
                <div
                  key={item}
                  className='rounded-xl border border-white/20 p-4 text-center text-sm font-medium'
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
