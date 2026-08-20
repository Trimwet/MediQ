import { CheckCircle2, MoreHorizontal, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  canCancel,
  canNoShow,
  nextStatus,
  type Appointment,
  type AppointmentStatus,
} from '../schema'

type AppointmentRowActionsProps = {
  appointment: Appointment
  onStatusChange: (id: string, status: AppointmentStatus) => void
  onApprove: (appointment: Appointment) => void
  onReject: (appointment: Appointment) => void
}

export function AppointmentRowActions({
  appointment,
  onStatusChange,
  onApprove,
  onReject,
}: AppointmentRowActionsProps) {
  const next = nextStatus[appointment.status]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='size-8 p-0'>
          <span className='sr-only'>Open menu</span>
          <MoreHorizontal className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-44'>
        {appointment.status === 'pending' ? (
          <>
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              Review request
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onApprove(appointment)}>
              <CheckCircle2 />
              Approve
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReject(appointment)}>
              <XCircle />
              Reject
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              Update status
            </DropdownMenuLabel>
            {next && (
              <>
                <DropdownMenuItem
                  onClick={() => onStatusChange(appointment.id, next)}
                >
                  {next === 'arrived'
                    ? 'Check in'
                    : next === 'in_progress'
                      ? 'Start visit'
                      : 'Complete'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {canCancel.includes(appointment.status) && (
              <DropdownMenuItem
                onClick={() => onStatusChange(appointment.id, 'cancelled')}
              >
                Cancel
              </DropdownMenuItem>
            )}
            {canNoShow.includes(appointment.status) && (
              <DropdownMenuItem
                onClick={() => onStatusChange(appointment.id, 'no_show')}
              >
                Mark no-show
              </DropdownMenuItem>
            )}
            {!next &&
              !canCancel.includes(appointment.status) &&
              !canNoShow.includes(appointment.status) && (
                <DropdownMenuItem disabled>No further actions</DropdownMenuItem>
              )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
