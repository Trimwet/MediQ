import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { type Appointment } from '../schema'

type RejectDialogProps = {
  appointment: Appointment | null
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string | undefined) => void
}

/** Reject a pending booking request, with an optional reason for the patient. */
export function RejectDialog({
  appointment,
  onOpenChange,
  onConfirm,
}: RejectDialogProps) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (appointment) setReason('')
  }, [appointment])

  return (
    <Dialog open={!!appointment} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject booking request</DialogTitle>
          <DialogDescription>
            {appointment?.patientName}&apos;s request will be marked as
            declined. Optionally tell them why — the reason is shown to the
            patient.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-2'>
          <p className='text-sm font-medium'>
            Reason{' '}
            <span className='font-normal text-muted-foreground'>(optional)</span>
          </p>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder='e.g. The clinic is fully booked for that time.'
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant='destructive'
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
