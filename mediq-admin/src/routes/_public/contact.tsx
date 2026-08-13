import { createFileRoute, Link } from '@tanstack/react-router'
import { Mail, Phone, MapPin, Send, Clock, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_public/contact')({
  component: ContactPage,
})

const contactItems = [
  {
    icon: Phone,
    title: 'Phone',
    value: '+234 803 123 4567',
    sub: '24/7 — appointments & emergencies',
  },
  {
    icon: Mail,
    title: 'Email',
    value: 'info@mediq.clinic',
    sub: 'General inquiries & support',
  },
  {
    icon: MapPin,
    title: 'Address',
    value: 'Rayfield Road, Jos',
    sub: 'Plateau State, Nigeria',
  },
  {
    icon: Clock,
    title: 'Hours',
    value: 'Mon – Sat: 8:00 AM – 8:00 PM',
    sub: 'Sunday: emergency only',
  },
]

function ContactPage() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 4000)
  }

  return (
    <div className='pb-24'>
      {/* Header */}
      <section className='bg-muted/40 py-20 text-center'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <p className='mb-4 text-xs font-semibold uppercase tracking-widest text-primary'>
            Contact Us
          </p>
          <h1 className='font-manrope text-4xl font-bold tracking-tight mb-6 sm:text-5xl'>
            Get in Touch
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed'>
            Questions about appointments or the clinic? Reach us through any
            channel below — we respond within 24 hours.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className='mx-auto max-w-6xl px-4 sm:px-6 -mt-10'>
        <div className='grid lg:grid-cols-5 gap-10'>
          {/* Contact Information */}
          <div className='lg:col-span-2'>
            <div className='rounded-2xl border border-border bg-card p-8 shadow-sm'>
              <h2 className='font-manrope font-semibold text-lg mb-6'>
                Contact Information
              </h2>

              <div className='divide-y divide-border'>
                {contactItems.map((item) => (
                  <div
                    key={item.title}
                    className='flex items-start gap-4 py-5 first:pt-0 last:pb-0'
                  >
                    <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                      <item.icon className='size-5' />
                    </div>
                    <div>
                      <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                        {item.title}
                      </p>
                      <p className='font-semibold text-foreground'>
                        {item.value}
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        {item.sub}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className='mt-6 rounded-xl bg-muted/60 p-4'>
                <p className='text-sm text-muted-foreground mb-3'>
                  Prefer to book online? Skip the call — book in under 3 minutes.
                </p>
                <Button size='sm' asChild>
                  <Link to='/book'>Book an appointment</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className='lg:col-span-3'>
            <div className='rounded-2xl border border-border bg-card p-8 shadow-sm md:p-10'>
              {submitted ? (
                <div className='py-16 text-center'>
                  <div className='mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10'>
                    <CheckCircle2 className='size-12 text-primary' />
                  </div>
                  <h3 className='font-manrope text-xl font-semibold mb-2'>
                    Message Sent
                  </h3>
                  <p className='text-muted-foreground'>
                    Thanks — we'll get back to you within one business day.
                  </p>
                </div>
              ) : (
                <>
                  <h2 className='font-manrope text-xl font-semibold mb-1'>
                    Send us a Message
                  </h2>
                  <p className='text-sm text-muted-foreground mb-8'>
                    We'll get back to you within one business day.
                  </p>

                  <form onSubmit={handleSubmit} className='space-y-5'>
                    <div className='grid md:grid-cols-2 gap-5'>
                      <div className='space-y-2'>
                        <Label htmlFor='name' className='text-sm font-medium'>
                          Full Name
                        </Label>
                        <Input
                          id='name'
                          required
                          placeholder='Your full name'
                          className='rounded-lg'
                        />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='email' className='text-sm font-medium'>
                          Email Address
                        </Label>
                        <Input
                          id='email'
                          type='email'
                          required
                          placeholder='you@example.com'
                          className='rounded-lg'
                        />
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='subject' className='text-sm font-medium'>
                        Subject
                      </Label>
                      <Input
                        id='subject'
                        required
                        placeholder='How can we help?'
                        className='rounded-lg'
                      />
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='message' className='text-sm font-medium'>
                        Message
                      </Label>
                      <Textarea
                        id='message'
                        rows={5}
                        required
                        placeholder='Tell us more about your inquiry...'
                        className='rounded-lg'
                      />
                    </div>

                    <div className='flex flex-col sm:flex-row sm:items-center gap-4'>
                      <Button type='submit' size='lg' className='w-full sm:w-auto'>
                        Send Message
                        <Send className='ml-2 size-4' />
                      </Button>
                      <p className='text-xs text-muted-foreground'>
                        By submitting you agree to be contacted about your
                        inquiry.
                      </p>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className='mt-20 overflow-hidden rounded-2xl border border-border shadow-sm h-[450px] relative'>
          <div className='absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-card/95 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur'>
            <MapPin className='size-4 text-primary' />
            Rayfield Road, Jos — Plateau State, Nigeria
          </div>
          <iframe
            src='https://www.google.com/maps?q=Rayfield,+Jos,+Plateau+State,+Nigeria&output=embed'
            width='100%'
            height='100%'
            style={{ border: 0 }}
            allowFullScreen
            loading='lazy'
            title='MediQ Clinic Location'
          />
        </div>
      </div>
    </div>
  )
}
