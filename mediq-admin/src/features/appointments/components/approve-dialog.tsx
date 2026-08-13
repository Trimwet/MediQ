import { useEffect, useState } from 'react'
import { useDoctors } from '@/data/hooks'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SelectDropdown } from '@/components/select-dropdown'
import { type Appointment } from '../schema'

type ApproveDialogProps = {
  appointment: Appointment | null
  onOpenChange: (open: boolean) => void
  onConfirm: (doctorId: string, doctorName: string) => void
}

/**
 * Shown when staff approve a pending request that had no doctor preference:
 * the clinic assigns a doctor as part of the approval.
 */
export function ApproveDialog({
  appointment,
  onOpenChange,
  onConfirm,
}: ApproveDialogProps) {
  const [doctorId, setDoctorId] = useState('')
  const doctorsQuery = useDoctors()

  useEffect(() => {
    if (appointment) setDoctorId('')
  }, [appointment])

  const activeDoctors = (doctorsQuery.data ?? []).filter(
    (d) => d.status === 'active'
  )
  const doctor = activeDoctors.find((d) => d.id === doctorId)

  return (
    <Dialog open={!!appointment} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a doctor and approve</DialogTitle>
          <DialogDescription>
            {appointment?.patientName} didn&apos;t choose a doctor. Pick one to
            approve the request.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-2'>
          <p className='text-sm font-medium'>Doctor</p>
          <SelectDropdown
            isControlled
            defaultValue={doctorId}
            onValueChange={setDoctorId}
            isPending={doctorsQuery.isPending}
            placeholder='Choose a doctor'
            items={activeDoctors.map((d) => ({
              label: `${d.name} — ${d.specialization}`,
              value: d.id,
            }))}
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!doctor}
            onClick={() => doctor && onConfirm(doctor.id, doctor.name)}
          >
            Approve &amp; assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
