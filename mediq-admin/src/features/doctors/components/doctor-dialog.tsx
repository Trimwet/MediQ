import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Stethoscope } from 'lucide-react'
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
import { type Doctor } from '../schema'
import { specializations } from '../schema'

const formSchema = z.object({
  name: z.string().min(2, 'Please enter the doctor name.'),
  specialization: z.string().min(1, 'Please choose a specialization.'),
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter an email.' : undefined),
  }),
})

type DoctorForm = z.infer<typeof formSchema>

type DoctorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (doctor: Omit<Doctor, 'id'>) => void
}

export function DoctorDialog({
  open,
  onOpenChange,
  onCreated,
}: DoctorDialogProps) {
  const form = useForm<DoctorForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', specialization: '', email: '' },
    mode: 'onTouched',
  })

  function onSubmit(values: DoctorForm) {
    onCreated({
      name: values.name,
      specialization: values.specialization,
      email: values.email,
      status: 'active',
      todayAppointments: 0,
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
            <Stethoscope /> Add doctor
          </DialogTitle>
          <DialogDescription>
            Register a doctor in the clinic directory.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='doctor-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder='eg: Dr. Chukwuemeka' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='specialization'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialization</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='Select a specialization'
                    items={specializations.map((s) => ({
                      value: s,
                      label: s,
                    }))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='eg: dr.name@mediq.ng'
                      {...field}
                    />
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
          <Button
            type='submit'
            form='doctor-form'
            disabled={form.formState.isSubmitting || (form.formState.isDirty && !form.formState.isValid)}
          >
            Add doctor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
