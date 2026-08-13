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
      <section className='bg-muted/40 py-20 text-center'>
        <div className='mx-auto max-w-6xl px-4'>
          <p className='text-xs font-semibold uppercase tracking-widest text-primary mb-3'>
            Departments
          </p>
          <h1 className='font-manrope text-4xl sm:text-5xl font-bold tracking-tight mb-4'>
            Our Departments
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground'>
            Comprehensive medical services across all major specialties.
          </p>
        </div>
      </section>

      {/* Grid */}
      <div className='mx-auto max-w-6xl px-4 py-16'>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {departments.map((dept) => (
            <Link
              key={dept.id}
              to='/departments/$id'
              params={{ id: dept.id }}
              className='group h-full'
            >
              <div className='h-full flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40'>
                <div className='h-40 overflow-hidden'>
                  <img
                    src={dept.image}
                    alt={dept.title}
                    className='size-full object-cover transition-transform duration-500 group-hover:scale-110'
                    referrerPolicy='no-referrer'
                  />
                </div>
                <div className='p-5 flex flex-col flex-1'>
                  <h3 className='font-manrope text-base font-semibold tracking-tight'>
                    {dept.title}
                  </h3>
                  <p className='mt-1.5 text-sm text-muted-foreground line-clamp-2'>
                    {dept.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Info Section */}
        <div className='mt-16 rounded-2xl border border-border bg-muted/50 p-10 md:p-14'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-10 items-center'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-widest text-primary mb-3'>
                Need something else?
              </p>
              <h2 className='font-manrope text-2xl sm:text-3xl font-semibold tracking-tight'>
                Can&rsquo;t find what you&rsquo;re looking for?
              </h2>
              <p className='mt-3 text-muted-foreground'>
                We offer many more specialized services — our team can point you to the right department.
              </p>
              <div className='mt-6 flex gap-3 flex-wrap'>
                <Button asChild>
                  <a href='tel:+2348031234567'>
                    <Phone />
                    Call Help Desk
                  </a>
                </Button>
                <Button variant='outline' asChild>
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
                  className='rounded-xl border border-border bg-card p-4 text-center text-sm font-medium'
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
