import { createFileRoute } from '@tanstack/react-router'
import { Activity } from 'lucide-react'
import { services } from '@/data/landing/services'

export const Route = createFileRoute('/_public/services')({
  component: ServicesPage,
})

function ServicesPage() {
  return (
    <div className='pb-24'>
      {/* Header */}
      <section className='bg-muted/40 py-24 text-center'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <h1 className='font-manrope text-4xl font-bold tracking-tight mb-6 sm:text-5xl'>
            Our Premium Services
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed'>
            We provide a wide range of medical services designed to meet all your
            healthcare needs under one roof.
          </p>
        </div>
      </section>

      {/* Grid */}
      <div className='mx-auto max-w-6xl px-4 sm:px-6 py-20'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
          {services.map((service) => (
            <div
              key={service.title}
              className='group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40'
            >
              <div className='h-44 w-full overflow-hidden bg-muted/40 relative'>
                <img
                  src={service.image}
                  alt={service.title}
                  className='size-full object-cover transition-transform duration-500 group-hover:scale-110'
                  referrerPolicy='no-referrer'
                />
              </div>
              <div className='p-6'>
                <h3 className='font-manrope text-lg font-semibold tracking-tight group-hover:text-primary transition-colors'>
                  {service.title}
                </h3>
                <p className='mt-2 text-sm text-muted-foreground leading-relaxed'>
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Featured Service */}
        <div className='mt-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center'>
          <div>
            <span className='text-sm font-bold uppercase tracking-widest text-primary mb-4 block'>
              Featured Service
            </span>
            <h2 className='font-manrope text-3xl font-bold tracking-tight mb-6 sm:text-4xl'>
              Advanced Telemedicine Services
            </h2>
            <p className='text-lg text-muted-foreground leading-relaxed mb-8'>
              Consult with our expert doctors from the comfort of your home. Our
              secure telemedicine platform allows you to have video
              consultations, share reports, and get prescriptions digitally.
            </p>
            <ul className='space-y-4 mb-10'>
              {[
                'Secure Video Calls',
                'Digital Prescriptions',
                'Report Sharing',
                'Easy Scheduling',
              ].map((item) => (
                <li
                  key={item}
                  className='flex items-center font-medium text-foreground'
                >
                  <div className='flex size-6 items-center justify-center rounded-full bg-primary/10 mr-3'>
                    <Activity className='size-3 text-primary' />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <img
              src='https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=1000'
              alt='Telemedicine Service'
              className='rounded-2xl shadow-2xl'
              referrerPolicy='no-referrer'
            />
          </div>
        </div>
      </div>
    </div>
  )
}
