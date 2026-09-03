import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { format, startOfDay, isSameDay } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useSearch } from '@tanstack/react-router'
import { type BookingResult } from '@/data'
import { type Appointment } from '@/features/appointments/schema'
import {
  useBookAppointment,
  usePublicClinics,
  usePublicDoctors,
  useSignUp,
} from '@/data/hooks'
import {
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  KeyRound,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/assets/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/date-picker'
import { PasswordInput } from '@/components/password-input'
import { SearchableSelect } from '@/components/searchable-select'
import { SelectDropdown } from '@/components/select-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

const TIME_SLOTS = [
  { label: '9:00 AM', hour: 9 },
  { label: '10:00 AM', hour: 10 },
  { label: '11:00 AM', hour: 11 },
  { label: '12:00 PM', hour: 12 },
  { label: '1:00 PM', hour: 13 },
  { label: '2:00 PM', hour: 14 },
  { label: '3:00 PM', hour: 15 },
  { label: '4:00 PM', hour: 16 },
]

const formSchema = z.object({
  patientName: z.string().min(2, 'Please enter your full name.').max(60),
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter your email.' : undefined),
  }),
  phone: z.string().min(7, 'Please enter a valid phone number.'),
  clinicId: z.string().optional(),
  doctorId: z.string().optional(),
  date: z.date({ message: 'Please choose a date.' }),
  time: z.string().min(1, 'Please choose a time.'),
  reason: z.string().max(300).optional(),
})

type FormValues = z.infer<typeof formSchema>

export function Booking() {
  const [result, setResult] = useState<BookingResult | null>(null)
  const book = useBookAppointment()
  const clinicsQuery = usePublicClinics()

  const urlClinicId = useSearch({ from: '/book' }).clinicId

  const defaultClinicId = urlClinicId ?? clinicsQuery.data?.[0]?.id ?? ''

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientName: '',
      email: '',
      phone: '',
      clinicId: defaultClinicId,
      doctorId: 'no_preference',
      date: undefined,
      time: '',
      reason: '',
    },
  })

  // B-09: Sync async defaultClinicId into the form once it resolves.
  // Only writes if the field is still empty (avoids wiping user edits).
  useEffect(() => {
    if (defaultClinicId && !form.getValues('clinicId')) {
      form.setValue('clinicId', defaultClinicId)
    }
  }, [defaultClinicId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedClinicId = form.watch('clinicId') || defaultClinicId
  const doctorsQuery = usePublicDoctors(selectedClinicId || undefined)

  // Public RPC already filters to active doctors; keep a tolerant filter
  // so the same component works if the hook ever returns a status field.
  const activeDoctors = useMemo(() => {
    const list = doctorsQuery.data ?? []
    return list.filter(
      (d) => !('status' in d) || (d as { status?: string }).status === 'active'
    )
  }, [doctorsQuery.data])

  // Clinics can have many doctors, so the picker groups them by specialty
  // (with a count per group) while still allowing a name/specialty search.
  const doctorGroups = useMemo(() => {
    const bySpecialty = new Map<string, { label: string; value: string }[]>()
    for (const doctor of activeDoctors) {
      const key = doctor.specialization
      const list = bySpecialty.get(key) ?? []
      list.push({
        label: `${doctor.name} — ${key}`,
        value: doctor.id,
      })
      bySpecialty.set(key, list)
    }
    const specialtyGroups = [...bySpecialty.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([specialty, doctorItems]) => ({
        heading: specialty,
        count: doctorItems.length,
        items: doctorItems,
      }))
    return [
      {
        items: [
          {
            label: 'No preference — match me with a doctor',
            value: 'no_preference',
          },
        ],
      },
      ...specialtyGroups,
    ]
  }, [activeDoctors])

  const selectedDate = form.watch('date')
  const availableTimeSlots = useMemo(() => {
    const isToday = selectedDate && isSameDay(selectedDate, new Date())
    const currentHour = new Date().getHours()
    return TIME_SLOTS.filter((slot) => !isToday || slot.hour > currentHour)
  }, [selectedDate])

  function onSubmit(values: FormValues) {
    const slot = TIME_SLOTS.find((s) => s.label === values.time)
    if (!slot) return
    // Doctor is optional — patients may not know one by name, so the clinic
    // assigns a suitable doctor when the request is approved.
    const doctor =
      values.doctorId && values.doctorId !== 'no_preference'
        ? activeDoctors.find((d) => d.id === values.doctorId)
        : undefined

    // NOTE: Clinic operates in Africa/Lagos (WAT, UTC+1).
    // Construct the scheduled time in UTC so the server stores the correct
    // instant. If date-fns-tz is added later, prefer tzToZonedTime /
    // formatInTimeZone for explicit timezone handling.
    const d = values.date
    const scheduledFor = new Date(Date.UTC(
      d.getFullYear(), d.getMonth(), d.getDate(),
      slot.hour - 1, // WAT = UTC+1 → subtract 1 for UTC
      0, 0, 0,
    ))

    const chosenClinicId = values.clinicId || selectedClinicId || undefined

    book.mutate(
      {
        patientName: values.patientName,
        email: values.email,
        phone: values.phone,
        doctorId: doctor?.id,
        doctorName: doctor?.name,
        scheduledFor: scheduledFor.toISOString(),
        reason: values.reason || undefined,
        clinicId: chosenClinicId,
      },
      {
        onSuccess: (bookingResult) => {
          try {
            const emailLower = bookingResult?.appointment?.patientEmail
              ? String(bookingResult.appointment.patientEmail).toLowerCase()
              : String(values.email).toLowerCase()
            const now = Date.now()
            // Legacy global keys (kept for backward compat)
            localStorage.setItem('mediq_has_booked', 'true')
            if (emailLower) {
              localStorage.setItem('mediq_has_booked_email', emailLower)
            }
            localStorage.setItem('mediq_has_booked_at', String(now))
            // Clinic-scoped keys with email and expiry
            if (chosenClinicId && emailLower) {
              localStorage.setItem(
                `mediq_has_booked:${chosenClinicId}`,
                JSON.stringify({ email: emailLower, at: now })
              )
              localStorage.setItem(`mediq_has_booked:${chosenClinicId}:${emailLower}`, 'true')
              localStorage.setItem(`mediq_has_booked_at:${chosenClinicId}`, String(now))
              localStorage.setItem(`mediq_has_booked_at:${chosenClinicId}:${emailLower}`, String(now))
              localStorage.setItem(`mediq_has_booked_email:${chosenClinicId}`, emailLower)
            }

            const chosenClinicObj = (clinicsQuery.data ?? []).find((c: { id: string; name: string }) => c.id === chosenClinicId)
            const chosenClinicName = chosenClinicObj ? chosenClinicObj.name : 'JUTH (Jos University Teaching Hospital)'
            const doctorName = doctor ? doctor.name : 'Assigned Doctor (Pending Staff Assignment)'

            const fullAppointment: Appointment = {
              id: bookingResult?.appointment?.id ?? `apt-${Date.now()}`,
              patientName: values.patientName,
              patientEmail: emailLower,
              doctorId: doctor?.id ?? '',
              doctorName: bookingResult?.appointment?.doctorName || doctorName,
              clinicId: chosenClinicId,
              clinicName: chosenClinicName,
              scheduledFor: scheduledFor.toISOString(),
              status: 'pending',
              reason: values.reason || 'General Medical Visit',
            }

            // Save appointment object locally for instant patient portal display
            localStorage.setItem('mediq_last_booked_appointment', JSON.stringify(fullAppointment))
            if (fullAppointment.id) {
              localStorage.setItem(`mediq_patient_appointment:${fullAppointment.id}`, JSON.stringify(fullAppointment))
            }
          } catch {}
          setResult(bookingResult)
          form.reset()
        },
      }
    )
  }

  const selectedClinic = clinicsQuery.data?.find(
    (c) => c.id === (form.watch('clinicId') || selectedClinicId)
  )

  if (result) {
    return (
      <BookingSuccess
        result={result}
        clinicName={selectedClinic?.name}
        onBookAnother={() => setResult(null)}
      />
    )
  }

  return (
    <div className='min-h-svh bg-muted/40'>
      <header className='flex h-16 items-center justify-between px-4 sm:px-6'>
        <div className='flex items-center gap-2'>
          <Button variant='ghost' size='sm' asChild>
            <Link to='/' aria-label='Back to home'>
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <Link to='/' aria-label='MediQ home'>
            <Logo className='h-9' />
          </Link>
        </div>
        <div className='flex items-center gap-2'>
          <ThemeSwitch />
          <Button variant='outline' size='sm' asChild>
            <Link to='/sign-in'>Sign in</Link>
          </Button>
        </div>
      </header>

      <main className='mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-bold tracking-tight'>
            Book an appointment
          </h1>
          <p className='text-sm text-muted-foreground'>
            No account needed — book in under a minute. Your request goes to the
            clinic for approval, and you can set a password to track it.
          </p>
        </div>

        <Card>
          <CardHeader className='flex flex-row items-center gap-2 space-y-0 text-sm text-muted-foreground'>
            <CalendarCheck2 className='size-4' />
            Choose your preferred hospital, doctor and time
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='grid gap-4 sm:grid-cols-2'
                noValidate
              >
                <FormField
                  control={form.control}
                  name='patientName'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder='Aisha Bello' {...field} />
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
                          placeholder='you@example.com'
                          {...field}
                        />
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
                        <Input placeholder='+234 800 000 0000' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='clinicId'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>Hospital / Clinic</FormLabel>
                      <SelectDropdown
                        isControlled
                        defaultValue={field.value || defaultClinicId}
                        onValueChange={(val) => {
                          field.onChange(val)
                          form.setValue('doctorId', 'no_preference')
                        }}
                        placeholder={
                          clinicsQuery.isPending
                            ? 'Loading hospitals...'
                            : 'Choose a hospital or clinic'
                        }
                        items={(clinicsQuery.data ?? []).map((c) => ({
                          label: c.name,
                          value: c.id,
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
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>
                        Doctor{' '}
                        <span className='font-normal text-muted-foreground'>
                          (optional)
                        </span>
                      </FormLabel>
                      <SearchableSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        isPending={doctorsQuery.isPending}
                        placeholder='Search and choose a doctor'
                        searchPlaceholder='Search by name or specialty'
                        emptyText='No doctor matches your search.'
                        groups={doctorGroups}
                      />
                      <p className='text-xs text-muted-foreground'>
                        Pick the doctor you&apos;d like to see, or leave it on
                        &ldquo;No preference&rdquo; and we&apos;ll assign the
                        doctor best suited to your visit.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='date'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <DatePicker
                          selected={field.value}
                          onSelect={field.onChange}
                          placeholder='Pick a date'
                          className='w-full'
                          disabled={(date) => date < startOfDay(new Date())}
                        />
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
                      <SelectDropdown
                        isControlled
                        defaultValue={field.value}
                        onValueChange={field.onChange}
                        placeholder='Choose a time'
                        items={availableTimeSlots.map((slot) => ({
                          label: slot.label,
                          value: slot.label,
                        }))}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='reason'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>
                        Reason for visit{' '}
                        <span className='font-normal text-muted-foreground'>
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='Briefly describe your symptoms'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type='submit'
                  className='sm:col-span-2'
                  disabled={book.isPending}
                >
                  {book.isPending ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <CalendarCheck2 />
                  )}
                  {book.isPending ? 'Booking...' : 'Confirm appointment'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'Please enter your password.')
      .min(7, 'Password must be at least 7 characters long.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

type PasswordValues = z.infer<typeof passwordSchema>

function BookingSuccess({
  result,
  clinicName,
  onBookAnother,
}: {
  result: BookingResult
  clinicName?: string
  onBookAnother: () => void
}) {
  const { appointment, hasAccount } = result
  const [accountCreated, setAccountCreated] = useState(false)
  const signUp = useSignUp()
  const when = format(
    new Date(appointment.scheduledFor),
    'EEEE, MMM d • h:mm a'
  )
  const email = appointment.patientEmail ?? ''

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  function onCreatePassword(values: PasswordValues) {
    signUp.mutate(
      { email, password: values.password },
      {
        onSuccess: () => setAccountCreated(true),
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Something went wrong creating your account.'
          )
        },
      }
    )
  }

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10'>
      <Link to='/' aria-label='MediQ home'>
        <Logo className='h-10' />
      </Link>

      <Link
        to='/'
        className='inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
      >
        <ArrowLeft className='size-4' />
        Back to home
      </Link>

      <Card className='w-full max-w-md'>
        <CardContent className='flex flex-col gap-4 pt-6 text-center'>
          <CheckCircle2 className='mx-auto size-10 text-emerald-500' />
          <div className='space-y-1'>
            <h1 className='text-xl font-bold tracking-tight'>
              Booking request sent
            </h1>
            <p className='text-sm text-muted-foreground'>
              Reference{' '}
              <span className='font-mono text-foreground'>
                {appointment.id}
              </span>
            </p>
          </div>

          <dl className='space-y-2 rounded-lg border bg-muted/40 p-4 text-start text-sm'>
            {clinicName && (
              <div className='flex justify-between gap-4'>
                <dt className='text-muted-foreground'>Hospital</dt>
                <dd className='font-medium'>{clinicName}</dd>
              </div>
            )}
            <div className='flex justify-between gap-4'>
              <dt className='text-muted-foreground'>Patient</dt>
              <dd className='font-medium'>{appointment.patientName}</dd>
            </div>
            <div className='flex justify-between gap-4'>
              <dt className='text-muted-foreground'>Doctor</dt>
              <dd className='font-medium'>{appointment.doctorName}</dd>
            </div>
            <div className='flex justify-between gap-4'>
              <dt className='text-muted-foreground'>When</dt>
              <dd className='font-medium'>{when}</dd>
            </div>
          </dl>

          <p className='rounded-lg bg-muted/60 p-3 text-start text-xs text-muted-foreground'>
            The clinic reviews your request and confirms before it appears on
            the schedule. You&apos;ll be able to track it once you sign in.
          </p>

          {hasAccount || accountCreated ? (
            <div className='flex flex-col gap-2'>
              {accountCreated && (
                <p className='rounded-lg bg-emerald-50 p-3 text-start text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'>
                  Account created — you can now sign in and track your
                  appointment.
                </p>
              )}
              <Button asChild>
                <Link
                  to='/sign-in'
                  search={{ redirect: '/patient' }}
                  className='w-full'
                >
                  Sign in to view your appointments
                </Link>
              </Button>
              <Button variant='ghost' onClick={onBookAnother}>
                Book another appointment
              </Button>
            </div>
          ) : (
            <div className='rounded-lg border bg-muted/40 p-4 text-start'>
              <div className='flex items-center gap-2'>
                <KeyRound className='size-4 text-primary' />
                <p className='text-sm font-medium'>Create your password</p>
              </div>
              <p className='mt-1 text-xs text-muted-foreground'>
                We use the email you provided. Set a password now to sign in and
                track your booking — the rest of your details can be completed
                at sign-up.
              </p>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(onCreatePassword)}
                  className='mt-3 grid gap-3'
                  noValidate
                >
                  <div>
                    <FormLabel>Email</FormLabel>
                    <Input
                      type='email'
                      value={email}
                      disabled
                      className='mt-1'
                      aria-label='Email'
                    />
                  </div>
                  <FormField
                    control={passwordForm.control}
                    name='password'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder='••••••••'
                            autoComplete='new-password'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name='confirmPassword'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder='••••••••'
                            autoComplete='new-password'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type='submit'
                    className='mt-1'
                    disabled={signUp.isPending}
                  >
                    {signUp.isPending ? (
                      <Loader2 className='animate-spin' />
                    ) : (
                      <KeyRound />
                    )}
                    Create account &amp; password
                  </Button>
                </form>
              </Form>
              <Button
                variant='ghost'
                onClick={onBookAnother}
                className='mt-2 w-full'
              >
                Book another appointment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
