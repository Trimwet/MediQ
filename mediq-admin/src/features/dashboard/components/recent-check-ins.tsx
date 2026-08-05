import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, getDisplayNameInitials } from '@/lib/utils'

type CheckinStatus = 'checked-in' | 'in-progress' | 'completed'

type RecentCheckin = {
  patient: string
  time: string
  doctor: string
  department: string
  status: CheckinStatus
}

const recentCheckins: RecentCheckin[] = [
  {
    patient: 'Amina Bello',
    time: '9:15 AM',
    doctor: 'Dr. Okonkwo',
    department: 'Cardiology',
    status: 'completed',
  },
  {
    patient: 'Tunde Adebayo',
    time: '9:32 AM',
    doctor: 'Dr. Nwosu',
    department: 'Orthopedics',
    status: 'completed',
  },
  {
    patient: 'Chioma Eze',
    time: '9:48 AM',
    doctor: 'Dr. Okonkwo',
    department: 'Cardiology',
    status: 'in-progress',
  },
  {
    patient: 'Emeka Nnamdi',
    time: '10:05 AM',
    doctor: 'Dr. Ibrahim',
    department: 'General',
    status: 'in-progress',
  },
  {
    patient: 'Fatima Abubakar',
    time: '10:22 AM',
    doctor: 'Dr. Nwosu',
    department: 'Orthopedics',
    status: 'checked-in',
  },
]

const statusStyles: Record<CheckinStatus, { label: string; className: string }> =
  {
    'checked-in': {
      label: 'Checked in',
      className:
        'bg-sky-100/30 text-sky-900 border-sky-300 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-500/40',
    },
    'in-progress': {
      label: 'In progress',
      className:
        'bg-amber-100/30 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-500/40',
    },
    completed: {
      label: 'Completed',
      className:
        'bg-emerald-100/30 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-500/40',
    },
  }

export function RecentCheckIns() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className='space-y-2' aria-label='Loading recent check-ins'>
        <div className='flex items-center gap-2'>
          <Skeleton className='size-8 rounded-full' />
          <div className='space-y-1.5'>
            <Skeleton className='h-3 w-32' />
            <Skeleton className='h-3 w-20' />
          </div>
        </div>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className='flex items-center gap-2'>
            <Skeleton className='size-8 rounded-full' />
            <div className='flex flex-1 items-center justify-between'>
              <div className='space-y-1.5'>
                <Skeleton className='h-3 w-32' />
                <Skeleton className='h-3 w-40' />
              </div>
              <Skeleton className='h-5 w-20' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Check-in</TableHead>
          <TableHead>Doctor</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recentCheckins.map((checkin) => {
          const status = statusStyles[checkin.status]
          return (
            <TableRow key={checkin.patient}>
              <TableCell>
                <div className='flex items-center gap-2'>
                  <Avatar className='size-8'>
                    <AvatarFallback>
                      {getDisplayNameInitials(checkin.patient)}
                    </AvatarFallback>
                  </Avatar>
                  <span className='font-medium'>{checkin.patient}</span>
                </div>
              </TableCell>
              <TableCell className='text-muted-foreground'>
                {checkin.time}
              </TableCell>
              <TableCell>{checkin.doctor}</TableCell>
              <TableCell className='text-muted-foreground'>
                {checkin.department}
              </TableCell>
              <TableCell>
                <Badge
                  variant='outline'
                  className={cn('capitalize', status.className)}
                >
                  {status.label}
                </Badge>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}