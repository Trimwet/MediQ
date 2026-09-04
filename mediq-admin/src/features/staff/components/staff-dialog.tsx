import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentClinic } from '@/lib/clinic-context'
import { supabase } from '@/lib/supabase'
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
import { specializations } from '@/features/doctors/schema'
import { staffRoles, type Staff } from '../schema'

const formSchema = z
  .object({
    name: z.string().min(2, 'Please enter the staff name.'),
    role: z.string().min(1, 'Please choose a role.'),
    specialization: z.string().optional(),
    phone: z.string().min(7, 'Please enter a valid phone number.'),
    email: z.email({
      error: (iss) => (iss.input === '' ? 'Please enter an email.' : undefined),
    }),
  })
  .refine((data) => data.role !== 'doctor' || Boolean(data.specialization), {
    message: 'Please choose a specialization.',
    path: ['specialization'],
  })

type StaffForm = z.infer<typeof formSchema>

type StaffDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (member: Omit<Staff, 'id'>) => void
}

export function StaffDialog({
  open,
  onOpenChange,
  onCreated,
}: StaffDialogProps) {
  const [invite, setInvite] = useState<{ name: string; email: string } | null>(null)

  const form = useForm<StaffForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      role: '',
      specialization: '',
      phone: '',
      email: '',
    },
    mode: 'onTouched',
  })

  const role = form.watch('role')
  const { clinicId } = useCurrentClinic()

  async function onSubmit(values: StaffForm) {
    // Delegate everything to the invite-staff Edge Function:
    // it creates the auth user, sets the profile role, inserts the
    // staff/doctor + clinic_members records, and sends the invite email.
    const { error } = await supabase.functions.invoke('invite-staff', {
      body: {
        email: values.email,
        name: values.name,
        role: values.role,
        specialization: values.specialization,
        phone: values.phone,
        clinic_id: clinicId,
      },
    })

    if (error) {
      // FunctionsHttpError carries the JSON body in error.context
      const detail =
        (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json
          ? await (error as { context: { json: () => Promise<{ error?: string }> } }).context.json().then((j) => j.error).catch(() => null)
          : null
      toast.error(detail ?? error.message ?? 'Failed to send invite.')
      return
    }

    // Notify the parent so it can refetch the staff list.
    onCreated({
      name: values.name,
      role: values.role as Staff['role'],
      phone: values.phone,
      email: values.email,
      status: 'active',
    })

    setInvite({ name: values.name, email: values.email })
  }

  function closeDialog() {
    setInvite(null)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state) {
          setInvite(null)
          form.reset()
        }
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        {invite ? (
          <>
            <DialogHeader className='text-start'>
              <DialogTitle className='flex items-center gap-2'>
                <span className='flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary'>
                  <Check className='size-4' />
                </span>
                Invite ready
              </DialogTitle>
              <DialogDescription>
                An invite email has been sent to {invite.email}. They can click
                the link to set their password and sign in.
              </DialogDescription>
            </DialogHeader>
            <div className='rounded-lg border border-dashed p-4'>
              <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                Invite sent to
              </p>
              <p className='mt-1 font-mono text-sm font-semibold'>{invite.email}</p>
              <p className='mt-3 text-xs text-muted-foreground'>
                The link in the email takes them straight to password setup.
                If they don&apos;t receive it, check their spam folder.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={closeDialog}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className='text-start'>
              <DialogTitle className='flex items-center gap-2'>
                <UserPlus /> Invite staff
              </DialogTitle>
              <DialogDescription>
                Provision a staff account and assign their role. They&apos;ll
                receive a temporary password to sign in with.
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
                {role === 'doctor' && (
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
                )}
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
              <Button
                type='submit'
                form='staff-form'
                disabled={
                  form.formState.isSubmitting ||
                  (form.formState.isDirty && !form.formState.isValid)
                }
              >
                Invite staff
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
