import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateDoctor, useDoctors } from '@/data/hooks'
import { Check, Copy, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
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

/** Generate a human-friendly temporary password (no ambiguous characters). */
function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export function StaffDialog({
  open,
  onOpenChange,
  onCreated,
}: StaffDialogProps) {
  const [invite, setInvite] = useState<{
    name: string
    email: string
    temporaryPassword: string
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
  const tempPassword = useMemo(generateTempPassword, [invite])

  async function onSubmit(values: StaffForm) {
    // Create the Supabase Auth account with a temporary password.
    // The handle_new_user trigger auto-creates a profile with role 'patient';
    // in production the role is set via an Edge Function or admin action.
    const { error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: tempPassword,
      options: {
        data: {
          name: values.name,
          role: values.role,
        },
        emailRedirectTo: `${window.location.origin}/change-password`,
      },
    })

    // If the user already exists in auth, that's fine — we still create
    // the staff directory record. The existing account can sign in.
    if (authError && !authError.message?.includes('already been registered')) {
      toast.error(authError.message ?? 'Failed to create auth account.')
      return
    }

    // Create the staff directory record.
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

    setInvite({
      name: values.name,
      email: values.email,
      temporaryPassword: tempPassword,
    })
  }

  function handleCopy() {
    if (!invite) return
    navigator.clipboard?.writeText(invite.temporaryPassword)
    toast.success('Password copied')
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
                {invite.name} can now sign in. Share the temporary password with
                them — they&apos;ll set their own on first sign-in.
              </DialogDescription>
            </DialogHeader>
            <div className='rounded-lg border border-dashed p-4'>
              <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                Temporary password
              </p>
              <div className='mt-2 flex items-center justify-between gap-3'>
                <code className='font-mono text-lg font-semibold tracking-wider'>
                  {invite.temporaryPassword}
                </code>
                <Button variant='outline' size='sm' onClick={handleCopy}>
                  <Copy />
                  Copy
                </Button>
              </div>
              <p className='mt-3 text-xs text-muted-foreground'>
                Signed in as {invite.email}. First sign-in takes them straight
                to a password change.
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
