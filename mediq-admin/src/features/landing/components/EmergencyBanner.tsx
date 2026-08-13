import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Timer, CalendarCheck } from 'lucide-react'

export function EmergencyBanner() {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <div className='fixed bottom-3 right-3 z-[100]'>
      <div className='flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-foreground shadow-xl backdrop-blur-md transition-colors hover:bg-primary/15'>
        <div className='flex size-8 items-center justify-center rounded-full bg-primary/20'>
          <Timer className='size-4 text-primary' />
        </div>
        <div className='leading-tight'>
          <p className='text-xs font-semibold uppercase text-muted-foreground'>
            Live Queue
          </p>
          <p className='text-sm font-bold'>Real-time wait times</p>
        </div>
        <Link
          to='/book'
          className='flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90'
        >
          <CalendarCheck className='size-3.5' />
          Book now
        </Link>
        <button
          onClick={() => setVisible(false)}
          className='ml-1 text-lg text-muted-foreground hover:text-foreground'
          aria-label='Close'
        >
          &times;
        </button>
      </div>
    </div>
  )
}
