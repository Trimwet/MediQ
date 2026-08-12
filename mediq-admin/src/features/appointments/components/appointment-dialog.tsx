import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SelectDropdown } from '@/components/select-dropdown'
import { useDoctors, usePatients } from '@/data/hooks'
import { type Appointment } from '../schema'

const formSchema = z.object({
  patientId: z.string().min(1, 'Please choose a patient.'),
  doctorId: z.string().min(1, 'Please choose a doctor.'),
  date: z.string().min(1, 'Please choose a date.'),
  time: z.string().min(1, 'Please choose a time.'),
  reason: z.string().optional(),
})

type AppointmentForm = z.infer<typeof formSchema>

type AppointmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (input: Omit<Appointment, 'id' | 'status'>) => void
}

export function AppointmentDialog({
  open,
  onOpenChange,
  onCreated,
}: AppointmentDialogProps) {
  const patientsQuery = usePatients()
  const doctorsQuery = useDoctors()

  const form = useForm<AppointmentForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      date: '',
      time: '',
      reason: '',
    },
  })

  function onSubmit(values: AppointmentForm) {
    const doctor = doctorsQuery.data?.find((d) => d.id === values.doctorId)
    const patient = patientsQuery.data?.find((p) => p.id === values.patientId)
    if (!doctor || !patient) return

    onCreated({
      patientName: patient.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      scheduledFor: new Date(`${values.date}T${values.time}`).toISOString(),
      reason: values.reason || undefined,
    })
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2'>
            <CalendarPlus /> New appointment
          </DialogTitle>
          <DialogDescription>
            Book a patient with a doctor. The appointment starts as{' '}
            <span className='font-medium'>booked</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='appointment-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='patientId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='Select a patient'
                    isPending={patientsQuery.isPending}
                    items={patientsQuery.data?.map(({ id, name }) => ({
                      value: id,
                      label: name,
                    }))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='doctorId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doctor</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='Select a doctor'
                    isPending={doctorsQuery.isPending}
                    items={doctorsQuery.data?.map(
                      ({ id, name, specialization }) => ({
                        value: id,
                        label: `${name} — ${specialization}`,
                      })
                    )}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid grid-cols-2 gap-3'>
              <FormField
                control={form.control}
                name='date'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type='date' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='time'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type='time' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='reason'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder='Reason for the visit' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogClose>
          <Button type='submit' form='appointment-form'>
            Book appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
