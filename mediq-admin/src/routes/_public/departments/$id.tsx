import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, CalendarCheck } from 'lucide-react'
import { departments } from '@/data/landing/departments'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_public/departments/$id')({
  component: DepartmentDetailPage,
})

function DepartmentDetailPage() {
  const { id } = Route.useParams()
  const dept = departments.find((d) => d.id === id)

  if (!dept) {
    return (
      <div className='mx-auto max-w-6xl px-4 py-24 text-center'>
        <h1 className='font-manrope text-2xl font-bold tracking-tight'>
          Department not found
        </h1>
        <p className='mt-2 text-muted-foreground'>
          The department you&rsquo;re looking for doesn&rsquo;t exist.
        </p>
        <Button asChild className='mt-6'>
          <Link to='/departments'>
            <ArrowLeft />
            Back to Departments
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className='pb-24'>
      {/* Hero */}
      <section className='bg-muted/40 py-20 relative overflow-hidden'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6 relative z-10'>
          <Link
            to='/departments'
            className='inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground mb-8'
          >
            <ArrowLeft className='size-4' />
            All Departments
          </Link>
          <h1 className='font-manrope text-3xl font-bold tracking-tight sm:text-4xl'>
            {dept.title}
          </h1>
          <p className='mt-3 max-w-2xl text-muted-foreground'>
            {dept.description}
          </p>
        </div>
      </section>

      {/* Content */}
      <div className='mx-auto max-w-6xl px-4 sm:px-6 py-16'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-12'>
          <div className='lg:col-span-2 space-y-8'>
            <div className='rounded-xl border border-border bg-card p-8 shadow-sm'>
              <h2 className='font-manrope text-xl font-semibold tracking-tight mb-4'>
                About this Department
              </h2>
              <p className='text-muted-foreground leading-relaxed'>
                {dept.details}
              </p>
            </div>

            <div className='rounded-xl border border-border bg-card p-8 shadow-sm'>
              <h2 className='font-manrope text-xl font-semibold tracking-tight mb-4'>
                Services Offered
              </h2>
              <ul className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {dept.services.map((service) => (
                  <li
                    key={service}
                    className='flex items-center gap-2 text-sm text-muted-foreground'
                  >
                    <span className='size-1.5 rounded-full bg-primary shrink-0' />
                    {service}
                  </li>
                ))}
              </ul>
            </div>

            <div className='rounded-xl border border-border bg-card p-8 shadow-sm'>
              <h2 className='font-manrope text-xl font-semibold tracking-tight mb-4'>
                A Word from Our Team
              </h2>
              <p className='italic text-muted-foreground'>
                &ldquo;{dept.doctorMessage}&rdquo;
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className='space-y-6'>
            <div className='overflow-hidden rounded-xl border border-border bg-card shadow-sm'>
              <img
                src={dept.image}
                alt={dept.title}
                className='w-full h-48 object-cover'
                referrerPolicy='no-referrer'
              />
              <div className='p-6'>
                <h3 className='font-manrope font-semibold tracking-tight'>
                  {dept.title}
                </h3>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {dept.description}
                </p>
                <Button asChild className='mt-4 w-full'>
                  <Link to='/book'>
                    <CalendarCheck />
                    Book Appointment
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
