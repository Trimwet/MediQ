import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateDoctor, useDoctors } from '@/data/hooks'
import { supabaseAdmin } from '@/lib/supabase'
import { Check, Copy, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
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
  const [invite, setInvite] = useState<{
    name: string
    email: string
    inviteLink: string
  } | null>(null)

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
  const doctorsQuery = useDoctors()
  const createDoctor = useCreateDoctor()

  async function onSubmit(values: StaffForm) {
    let generatedInviteLink = ''

    if (!supabaseAdmin) {
      toast.error(
        'Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file to generate invite links.'
      )
      return
    }

    // Provision the Supabase Auth account via the admin API and generate a secure invite link.
    // If the user already exists in auth (e.g. they were previously deleted from staff but
    // their auth account remains), fall back to a password recovery link — same end result.
    let linkResult = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: values.email,
      options: {
        redirectTo: `${window.location.origin}/change-password`,
        data: {
          name: values.name,
          role: values.role,
        },
      },
    })

    if (
      linkResult.error &&
      linkResult.error.message?.toLowerCase().includes('already been registered')
    ) {
      // User exists — generate a password recovery link instead
      linkResult = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: values.email,
        options: {
          redirectTo: `${window.location.origin}/change-password`,
        },
      })
    }

    const { data, error } = linkResult

    if (error) {
      toast.error(error.message ?? 'Failed to generate invite link.')
      return
    }

    generatedInviteLink = data?.properties?.action_link ?? ''

    if (!generatedInviteLink) {
      toast.error('Invite link was not returned by Supabase. Check your service role key.')
      return
    }

    onCreated({
      name: values.name,
      role: values.role as Staff['role'],
      phone: values.phone,
      email: values.email,
      status: 'active',
    })

    // Doctors also need a directory record so their account can be matched
    // to appointments (row-level scoping). Skip if one already exists.
    if (values.role === 'doctor' && values.specialization) {
      const exists = doctorsQuery.data?.some(
        (d) => d.email?.toLowerCase() === values.email.toLowerCase()
      )
      if (!exists) {
        createDoctor.mutate({
          name: values.name,
          specialization: values.specialization,
          email: values.email,
          status: 'active',
          todayAppointments: 0,
        })
      }
    }

    setInvite({ name: values.name, email: values.email, inviteLink: generatedInviteLink })
  }

  function handleCopy() {
    if (!invite) return
    navigator.clipboard?.writeText(invite.inviteLink)
    toast.success('Invite link copied')
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
                {invite.name} can now access the system. Share this secure invite link with them.
              </DialogDescription>
            </DialogHeader>
            <div className='rounded-lg border border-dashed p-4'>
              <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                Invite Link
              </p>
              <div className='mt-2 space-y-2'>
                <code className='block w-full break-all rounded bg-muted px-3 py-2 font-mono text-xs leading-relaxed'>
                  {invite.inviteLink}
                </code>
                <Button variant='outline' size='sm' onClick={handleCopy} className='w-full'>
                  <Copy />
                  Copy invite link
                </Button>
              </div>
              <p className='mt-3 text-xs text-muted-foreground'>
                This secure link handles the entire onboarding process. They will be prompted to set their permanent password before accessing the dashboard.
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
                receive a secure invite link to set up their account.
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
