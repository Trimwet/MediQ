import { Link } from '@tanstack/react-router'
import { Globe, MessageCircle, Share2, ExternalLink, Mail, Phone, MapPin } from 'lucide-react'
import { Logo } from '@/assets/logo'

const quickLinks = [
  { to: '/about', label: 'About Us' },
  { to: '/doctors', label: 'Our Doctors' },
  { to: '/departments', label: 'Departments' },
  { to: '/services', label: 'Services' },
  { to: '/book', label: 'Book Appointment' },
]

const departmentLinks = [
  { to: '/departments', label: 'Cardiology' },
  { to: '/departments', label: 'Neurology' },
  { to: '/departments', label: 'Orthopedics' },
  { to: '/departments', label: 'Pediatrics' },
  { to: '/departments', label: 'Dermatology' },
]

const socials = [
  { icon: Globe, label: 'Website' },
  { icon: MessageCircle, label: 'WhatsApp' },
  { icon: Share2, label: 'Share' },
  { icon: ExternalLink, label: 'More' },
]

export function Footer() {
  return (
    <footer className='border-t border-border bg-card py-12'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <div className='grid gap-10 sm:grid-cols-2 md:grid-cols-4'>
          {/* Brand */}
          <div className='space-y-4'>
            <Link to='/' aria-label='MediQ home'>
              <Logo className='h-8' />
            </Link>
            <p className='text-sm leading-relaxed text-muted-foreground'>
              Real-time queue management and appointment booking for modern
              clinics. Powering smarter healthcare experiences.
            </p>
            <div className='flex gap-3'>
              {socials.map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href='#'
                  aria-label={label}
                  className='flex size-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary'
                >
                  <Icon className='size-4' />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className='font-manrope text-sm font-semibold tracking-tight'>
              Quick Links
            </h4>
            <ul className='mt-3 flex flex-col gap-2 text-sm text-muted-foreground'>
              {quickLinks.map((link) => (
                <li key={link.to + link.label}>
                  <Link to={link.to} className='transition-colors hover:text-foreground'>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Departments */}
          <div>
            <h4 className='font-manrope text-sm font-semibold tracking-tight'>
              Departments
            </h4>
            <ul className='mt-3 flex flex-col gap-2 text-sm text-muted-foreground'>
              {departmentLinks.map((link, i) => (
                <li key={i}>
                  <Link to={link.to} className='transition-colors hover:text-foreground'>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className='font-manrope text-sm font-semibold tracking-tight'>
              Contact Us
            </h4>
            <ul className='mt-3 flex flex-col gap-3 text-sm text-muted-foreground'>
              <li className='flex items-start gap-2'>
                <MapPin className='mt-0.5 size-4 shrink-0 text-primary' />
                <span>
                  14 Rayfield Road,
                  <br />
                  Jos, Plateau State, Nigeria
                </span>
              </li>
              <li className='flex items-center gap-2'>
                <Phone className='size-4 shrink-0 text-primary' />
                <span>
                  +234 803 123 4567
                  <br />
                  +234 807 234 5678
                </span>
              </li>
              <li className='flex items-center gap-2'>
                <Mail className='size-4 shrink-0 text-primary' />
                <span>info@mediq.clinic</span>
              </li>
            </ul>
          </div>
        </div>

        <div className='mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground'>
          &copy; {new Date().getFullYear()} MediQ. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
