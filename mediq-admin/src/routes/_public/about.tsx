import { createFileRoute } from '@tanstack/react-router'
import { Shield, Target, Eye, Award, Users, Heart } from 'lucide-react'

export const Route = createFileRoute('/_public/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className='pb-24'>
      {/* Hero */}
      <section className='bg-muted/40 py-24 relative overflow-hidden'>
        <div className='absolute top-0 right-0 w-1/2 h-full bg-primary/5 blur-3xl rounded-full translate-x-1/2' />
        <div className='mx-auto max-w-6xl px-4 sm:px-6 relative z-10'>
          <div className='max-w-3xl'>
            <h1 className='font-manrope text-4xl font-bold tracking-tight mb-8 leading-tight sm:text-5xl'>
              Dedicated to Your{' '}
              <span className='text-primary'>Health and Well-being</span>
            </h1>
            <p className='text-lg leading-relaxed text-muted-foreground sm:text-xl'>
              Powered by MediQ, our platform brings modern queue management and
              appointment booking to clinics — reducing wait times and improving
              patient satisfaction.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className='mx-auto max-w-6xl px-4 sm:px-6 py-24'>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-16 items-center'>
          <div>
            <h2 className='font-manrope text-3xl font-bold tracking-tight mb-8 sm:text-4xl'>
              Over 25 Years of Medical Excellence
            </h2>
            <div className='space-y-6 text-muted-foreground text-lg leading-relaxed'>
              <p>
                Our clinic started as a small practice with a big dream: to bring
                world-class healthcare to everyone. Today, we are a multi-specialty
                facility with over 150 specialists — powered by MediQ&rsquo;s
                real-time queue management platform.
              </p>
              <p>
                Our commitment to patient safety and clinical quality has earned us
                numerous awards. We continuously invest in the latest medical
                technologies, from advanced diagnostic imaging to digital patient
                management.
              </p>
              <div className='grid grid-cols-2 gap-6 pt-6'>
                <div className='flex items-center gap-3'>
                  <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10'>
                    <Users className='size-5 text-primary' />
                  </div>
                  <span className='font-semibold text-foreground'>
                    150+ Specialists
                  </span>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10'>
                    <Heart className='size-5 text-primary' />
                  </div>
                  <span className='font-semibold text-foreground'>
                    50k+ Happy Patients
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className='relative'>
            <img
              src='https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=1000'
              alt='Hospital Interior'
              className='rounded-2xl shadow-2xl'
              referrerPolicy='no-referrer'
            />
            <div className='absolute -bottom-8 -left-8 rounded-2xl border border-border bg-card p-6 shadow-xl hidden md:block'>
              <div className='text-4xl font-bold text-primary mb-1'>25+</div>
              <div className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Years of Experience
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className='bg-muted/40 py-20'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <h2 className='font-manrope text-2xl font-bold tracking-tight text-center mb-12 sm:text-3xl'>
            Our Values
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
            {[
              { icon: Shield, title: 'Patient Safety', desc: 'Every procedure follows strict safety protocols.' },
              { icon: Target, title: 'Precision', desc: 'Accurate diagnosis with advanced technology.' },
              { icon: Eye, title: 'Transparency', desc: 'Clear communication and real-time queue visibility.' },
              { icon: Award, title: 'Excellence', desc: 'Award-winning care and international standards.' },
              { icon: Users, title: 'Community', desc: 'Serving our community with compassion.' },
              { icon: Heart, title: 'Compassion', desc: 'Every patient treated with empathy and respect.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className='rounded-xl border border-border bg-card p-6 shadow-sm'
              >
                <div className='mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                  <Icon className='size-5' />
                </div>
                <h3 className='font-manrope font-semibold tracking-tight'>
                  {title}
                </h3>
                <p className='mt-1.5 text-sm text-muted-foreground'>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
