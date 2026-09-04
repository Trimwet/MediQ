import { PhoneOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDuration, minutesBetween } from '../data'
import { queueStatusBadge, type QueueEntry } from '../schema'

type QueueTableProps = {
  waiting: QueueEntry[]
  canManage: boolean
  onMarkLeft: (entry: QueueEntry) => void
}

export function QueueTable({ waiting, canManage, onMarkLeft }: QueueTableProps) {
  if (waiting.length === 0) {
    return (
      <div className='flex items-center justify-center rounded-md border py-10 text-sm text-muted-foreground'>
        No one is waiting. Check in the next appointment.
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-12'>#</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead className='hidden sm:table-cell'>
              Appointment time
            </TableHead>
            <TableHead>Wait</TableHead>
            <TableHead>Status</TableHead>
            {canManage && <TableHead className='w-24' />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {waiting.map((entry, index) => (
            <TableRow key={entry.id}>
              <TableCell className='text-muted-foreground'>{index + 1}</TableCell>
              <TableCell className='font-medium max-w-[160px]'>
                <div className='truncate' title={entry.patientName}>{entry.patientName}</div>
              </TableCell>
              <TableCell className='text-muted-foreground max-w-[160px]'>
                <div className='truncate' title={entry.doctorName}>{entry.doctorName}</div>
              </TableCell>
              <TableCell className='hidden text-muted-foreground sm:table-cell'>
                {new Date(entry.appointmentTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </TableCell>
              <TableCell>
                {formatDuration(
                  minutesBetween(entry.checkedInAt, new Date().toISOString())
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant='outline'
                  className={queueStatusBadge[entry.status]}
                >
                  {entry.status}
                </Badge>
              </TableCell>
              {canManage && (
                <TableCell className='text-end'>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => onMarkLeft(entry)}
                  >
                    <PhoneOff />
                    Mark left
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
