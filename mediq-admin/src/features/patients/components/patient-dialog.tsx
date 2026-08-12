import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
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
import { type Patient } from '../schema'

const formSchema = z.object({
  name: z.string().min(2, 'Please enter the patient name.'),
  phone: z.string().min(7, 'Please enter a valid phone number.'),
  email: z
    .string()
    .email({ error: (iss) => (iss.input ? 'Enter a valid email.' : undefined) })
    .optional()
    .or(z.literal('')),
})

type PatientForm = z.infer<typeof formSchema>

type PatientDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (patient: Omit<Patient, 'id'>) => void
}

export function PatientDialog({
  open,
  onOpenChange,
  onCreated,
}: PatientDialogProps) {
  const form = useForm<PatientForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', phone: '', email: '' },
  })

  function onSubmit(values: PatientForm) {
    onCreated({
      name: values.name,
      phone: values.phone,
      email: values.email || undefined,
      lastVisit: null,
      visits: 0,
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
            <UserPlus /> Add patient
          </DialogTitle>
          <DialogDescription>
            Register a new patient in the clinic directory.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='patient-form'
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
                    <Input placeholder='eg: Amina Suleiman' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='phone'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type='tel'
                      placeholder='eg: +234 801 234 5678'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='eg: amina@example.com'
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
          <Button type='submit' form='patient-form'>
            Add patient
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
