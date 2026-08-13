import { createFileRoute } from '@tanstack/react-router'
import { Mail, Phone, MapPin, Send } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_public/contact')({
  component: ContactPage,
})

function ContactPage() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className='pb-24'>
      {/* Header */}
      <section className='bg-muted/40 py-24 text-center'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <h1 className='font-manrope text-4xl font-bold tracking-tight mb-6 sm:text-5xl'>
            Get in Touch
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed'>
            Have questions or need assistance? Our team is here to help you 24/7.
            Reach out to us through any of the channels below.
          </p>
        </div>
      </section>

      <div className='mx-auto max-w-6xl px-4 sm:px-6 -mt-12'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-12'>
          {/* Contact Info */}
          <div className='lg:col-span-1 space-y-6'>
            {[
              {
                icon: Phone,
                title: 'Primary Call',
                info: '+234 803 123 4567',
                sub: '24/7 Availability',
              },
              {
                icon: Phone,
                title: 'Secondary',
                info: '+234 807 234 5678',
                sub: 'Support & Inquiry',
              },
              {
                icon: Mail,
                title: 'Email Us',
                info: 'info@mediq.clinic',
                sub: 'General Inquiries',
              },
              {
                icon: MapPin,
                title: 'Visit Us',
                info: 'Rayfield Road, Jos',
                sub: 'Plateau State, Nigeria',
              },
            ].map((item) => (
              <div
                key={item.title}
                className='flex items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-sm'
              >
                <div className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  <item.icon className='size-6' />
                </div>
                <div>
                  <h4 className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                    {item.title}
                  </h4>
                  <p className='text-lg font-bold text-foreground'>
                    {item.info}
                  </p>
                  <p className='text-sm text-muted-foreground'>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className='lg:col-span-2'>
            <div className='rounded-xl border border-border bg-card p-8 shadow-sm md:p-12'>
              {submitted ? (
                <div className='py-20 text-center'>
                  <h3 className='text-2xl font-bold text-primary mb-2'>
                    Successfully Submitted!
                  </h3>
                  <p className='text-muted-foreground'>
                    We will get back to you shortly.
                  </p>
                </div>
              ) : (
                <>
                  <h2 className='font-manrope text-2xl font-bold tracking-tight mb-8'>
                    Send us a Message
                  </h2>
                  <form onSubmit={handleSubmit} className='space-y-6'>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                      <div className='space-y-2'>
                        <Label htmlFor='name'>Full Name</Label>
                        <Input id='name' required />
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor='email'>Email Address</Label>
                        <Input id='email' type='email' required />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='subject'>Subject</Label>
                      <Input id='subject' required />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='message'>Message</Label>
                      <Textarea id='message' rows={5} required />
                    </div>
                    <Button type='submit' className='w-full'>
                      Send Message
                      <Send className='ml-2 size-4' />
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className='mt-20 overflow-hidden rounded-2xl border border-border shadow-sm h-[450px] relative'>
          <iframe
            src='https://www.google.com/maps?q=Rayfield,+Jos,+Plateau+State,+Nigeria&output=embed'
            width='100%'
            height='100%'
            style={{ border: 0 }}
            allowFullScreen
            loading='lazy'
          />
        </div>
      </div>
    </div>
  )
}
