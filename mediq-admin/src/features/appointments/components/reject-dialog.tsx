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
            This will notify the patient with your reason and proposed
            alternative.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-2'>
          <p className='text-sm font-medium'>
            Reason{' '}
            <span className='font-normal text-muted-foreground'>(required)</span>
          </p>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Fully booked at 2pm — would 3pm work? We'll notify the patient."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant='destructive'
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
