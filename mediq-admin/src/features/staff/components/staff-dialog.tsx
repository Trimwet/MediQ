import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserCog } from 'lucide-react'
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
import { staffRoles, type Staff } from '../schema'

const formSchema = z.object({
  name: z.string().min(2, 'Please enter the staff name.'),
  role: z.string().min(1, 'Please choose a role.'),
  phone: z.string().min(7, 'Please enter a valid phone number.'),
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter an email.' : undefined),
  }),
})

type StaffForm = z.infer<typeof formSchema>

type StaffDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (member: Omit<Staff, 'id'>) => void
}

export function StaffDialog({ open, onOpenChange, onCreated }: StaffDialogProps) {
  const form = useForm<StaffForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', role: '', phone: '', email: '' },
  })

  function onSubmit(values: StaffForm) {
    onCreated({
      name: values.name,
      role: values.role as Staff['role'],
      phone: values.phone,
      email: values.email,
      status: 'active',
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
            <UserCog /> Add staff
          </DialogTitle>
          <DialogDescription>
            Register a clinic staff member and assign their role.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='staff-form'
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
                    <Input placeholder='eg: Chiamaka Eze' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='role'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='Select a role'
                    items={staffRoles.map((role) => ({
                      value: role,
                      label: role.replace('_', ' '),
                    }))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='eg: name@mediq.ng'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogClose>
          <Button type='submit' form='staff-form'>
            Add staff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
