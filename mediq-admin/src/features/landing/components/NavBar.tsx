import { useState } from 'react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { CalendarCheck, Menu, X } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/departments', label: 'Departments' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
]

export function NavBar() {
  const [open, setOpen] = useState(false)
  const matchRoute = useMatchRoute()

  return (
    <nav className='sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur'>
      <div className='mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6'>
        <Link to='/' aria-label='MediQ home' className='shrink-0'>
          <Logo className='h-8' />
        </Link>

        <div className='hidden items-center gap-1 text-sm font-medium md:flex'>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors hover:text-foreground',
                matchRoute({ to: link.to, fuzzy: link.to !== '/' })
                  ? 'text-foreground bg-accent'
                  : 'text-muted-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className='flex items-center gap-2'>
          <ThemeSwitch />
          <Button variant='ghost' size='sm' asChild className='hidden sm:inline-flex'>
            <Link to='/sign-in'>Sign in</Link>
          </Button>
          <Button size='sm' asChild>
            <Link to='/book'>
              <CalendarCheck />
              Book appointment
            </Link>
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='md:hidden'
            aria-label='Toggle menu'
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <div className='border-t border-border px-4 py-3 md:hidden'>
          <div className='flex flex-col gap-1'>
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  matchRoute({ to: link.to, fuzzy: link.to !== '/' })
                    ? 'text-foreground bg-accent'
                    : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to='/sign-in'
              onClick={() => setOpen(false)}
              className='rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
