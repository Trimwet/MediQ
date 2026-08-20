import { useState } from 'react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { CalendarCheck, Menu } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ThemeSwitch } from '@/components/theme-switch'

const allLinks = [
  { to: '/', label: 'Home' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/about', label: 'About' },
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
          {allLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors hover:text-foreground',
                matchRoute({ to: link.to, fuzzy: link.to !== '/' })
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className='flex items-center gap-2'>
          <ThemeSwitch />
          <Button
            variant='ghost'
            size='sm'
            asChild
            className='hidden sm:inline-flex'
          >
            <Link to='/sign-in'>Sign in</Link>
          </Button>
          <Button size='sm' asChild>
            <Link to='/book'>
              <CalendarCheck />
              Book appointment
            </Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='md:hidden'
                aria-label='Toggle menu'
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side='right'
              className='flex w-72 flex-col gap-0 p-0 sm:w-80'
            >
              <SheetHeader className='border-b border-border p-5'>
                <SheetTitle className='sr-only'>Navigation menu</SheetTitle>
                <Link
                  to='/'
                  onClick={() => setOpen(false)}
                  aria-label='MediQ home'
                  className='shrink-0'
                >
                  <Logo className='h-8' />
                </Link>
              </SheetHeader>

              <nav className='flex-1 overflow-y-auto px-3 py-4'>
                <div className='flex flex-col gap-1'>
                  {allLinks.map((link) => (
                    <SheetClose asChild key={link.to}>
                      <Link
                        to={link.to}
                        className={cn(
                          'flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                          matchRoute({ to: link.to, fuzzy: link.to !== '/' })
                            ? 'bg-accent text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                  <SheetClose asChild>
                    <Link
                      to='/sign-in'
                      className='flex items-center rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground'
                    >
                      Sign in
                    </Link>
                  </SheetClose>
                </div>
              </nav>

              <SheetFooter className='border-t border-border p-4'>
                <Button size='lg' className='w-full' asChild>
                  <Link to='/book'>
                    <CalendarCheck />
                    Book appointment
                  </Link>
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
