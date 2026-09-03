import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateDoctor, useDoctors } from '@/data/hooks'
import { Check, Copy, UserPlus } from 'lucide-react'
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
  const { clinicId } = useCurrentClinic()
  const tempPassword = useMemo(generateTempPassword, [invite])

  async function onSubmit(values: StaffForm) {
    const memberRole =
      values.role === 'doctor'
        ? 'doctor'
        : values.role === 'admin'
          ? 'admin'
          : 'front_desk'

    // Create the Supabase Auth account with a temporary password.
    // The handle_new_user trigger auto-creates a profile with role 'patient';
    // in production the role is set via an Edge Function or admin action.
    const { data: authData, error: authError } = await supabase.auth.signUp({
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

    if (authError && !authError.message?.includes('already been registered')) {
      toast.error(authError.message ?? 'Failed to create auth account.')
      return
    }

    // New account: the sign-up response carries the user ID.
    // Existing account: the anon client can't see the ID, so the server links
    // membership + profile role + doctors.user_id via the link_clinic_member
    // RPC (SECURITY DEFINER, migration 20260903).
    const userAlreadyRegistered = Boolean(authError)
    let userId: string | null = null

    if (!userAlreadyRegistered) {
      userId = authData?.user?.id ?? null
    } else if (clinicId) {
      const { data: linkedUserId, error: linkError } = await supabase.rpc(
        'link_clinic_member',
        {
          p_clinic_id: clinicId,
          p_email: values.email,
          p_role: memberRole,
        }
      )
      if (linkError || !linkedUserId) {
        toast.error(
          linkError?.message ??
            'This account already exists but could not be linked to the clinic.'
        )
        return
      }
      userId = linkedUserId
    }

    // Create the staff directory record.
    onCreated({
      name: values.name,
      role: values.role as Staff['role'],
      phone: values.phone,
      email: values.email,
      status: 'active',
    })

    // Link a brand-new user to this clinic via clinic_members. Existing
    // accounts were already linked server-side by link_clinic_member.
    if (userId && clinicId && !userAlreadyRegistered) {
      const { error: memberErr } = await supabase
        .from('clinic_members')
        .insert({
          clinic_id: clinicId,
          user_id: userId,
          role: memberRole,
        })
      if (memberErr && !memberErr.message?.includes('duplicate')) {
        console.error('Failed to create clinic membership:', memberErr)
      }
    }

    // Doctors also need a directory record so their account can be matched
    // to appointments (row-level scoping). Skip if one already exists. Pass
    // the auth user ID so doctors.user_id is set on the directory row too.
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
          userId,
        })
      }
    }

    if (userAlreadyRegistered) {
      toast.success(
        `${values.name} already has an account — linked to this clinic.`
      )
      closeDialog()
      return
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
