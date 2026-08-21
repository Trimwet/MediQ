import { useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { format, startOfDay, isSameDay } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { type BookingResult } from '@/data'
import { useBookAppointment, usePublicDoctors, useSignUp } from '@/data/hooks'
import {
  ArrowLeft,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Circle,
  KeyRound,
  Loader2,
  PartyPopper,
  QrCode as QrCodeIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/assets/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { QrTicket } from '@/features/appointments/components/qr-ticket'
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
  doctorId: z.string().optional(),
  date: z.date({ message: 'Please choose a date.' }),
  time: z.string().min(1, 'Please choose a time.'),
  reason: z.string().max(300).optional(),
})

type FormValues = z.infer<typeof formSchema>

export function Booking() {
  const [result, setResult] = useState<BookingResult | null>(null)
  const book = useBookAppointment()
  // Guard against React 19 StrictMode double-mount firing the RPC twice.
  const submittingRef = useRef(false)
  // Read clinicId from URL search params (?clinicId=...) for the public booking page.
  const clinicId = useMemo(
    () => new URLSearchParams(window.location.search).get('clinicId') ?? undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [window.location.search]
  )
  const doctorsQuery = usePublicDoctors(clinicId)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientName: '',
      email: '',
      phone: '',
      doctorId: 'no_preference',
      date: undefined,
      time: '',
      reason: '',
    },
  })

  const activeDoctors = doctorsQuery.data ?? []

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
    if (submittingRef.current) return
    submittingRef.current = true
    const slot = TIME_SLOTS.find((s) => s.label === values.time)
    if (!slot) { submittingRef.current = false; return }
    // Doctor is optional — patients may not know one by name, so the clinic
    // assigns a suitable doctor when the request is approved.
    const doctor =
      values.doctorId && values.doctorId !== 'no_preference'
        ? activeDoctors.find((d) => d.id === values.doctorId)
        : undefined

    // TODO: This constructs the time in the user's local timezone. If the clinic
    // operates in a specific timezone, we should explicitly construct it in that tz.
    const scheduledFor = new Date(values.date)
    scheduledFor.setHours(slot.hour, 0, 0, 0)

    book.mutate(
      {
        patientName: values.patientName,
        email: values.email,
        phone: values.phone,
        doctorId: doctor?.id,
        doctorName: doctor?.name,
        scheduledFor: scheduledFor.toISOString(),
        reason: values.reason || undefined,
        clinicId,
      },
      {
        onSuccess: (bookingResult) => {
          setResult(bookingResult)
          form.reset()
          submittingRef.current = false
        },
        onError: (err) => {
          submittingRef.current = false
          toast.error(err instanceof Error ? err.message : 'Booking failed — please try again.')
        },
      }
    )
  }

  if (result) {
    return (
      <BookingSuccess result={result} onBookAnother={() => setResult(null)} />
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
            Choose your preferred doctor and time
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
                      {doctorsQuery.isError && (
                        <p className='text-xs text-destructive'>
                          Could not load doctors — try again later.
                        </p>
                      )}
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
  onBookAnother,
}: {
  result: BookingResult
  onBookAnother: () => void
}) {
  const { appointment, hasAccount } = result
  const [accountCreated, setAccountCreated] = useState(false)
  const [hasExistingAccount, setHasExistingAccount] = useState(hasAccount)
  const [ticketDone, setTicketDone] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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
        onSuccess: () => {
          setAccountCreated(true)
          setShowPassword(false)
        },
        onError: (error) => {
          const msg = error instanceof Error ? error.message : ''
          if (msg.includes('already') || msg.includes('already been registered')) {
            toast.info(
              'An account already exists with this email. You can sign in with your existing password.'
            )
            setHasExistingAccount(true)
            setShowPassword(false)
          } else {
            toast.error(msg || 'Something went wrong creating your account.')
          }
        },
      }
    )
  }

  const total = 3
  const doneCount =
    1 + (ticketDone ? 1 : 0) + (hasExistingAccount || accountCreated ? 1 : 0)
  const allDone = doneCount === total
  const pct = Math.round((doneCount / total) * 100)

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/40 px-4 py-6'>
      <Link to='/' aria-label='MediQ home'>
        <Logo className='h-8' />
      </Link>

      <Card className='w-full max-w-md overflow-hidden'>
        <CardContent className='flex flex-col gap-3 pt-5 text-center'>
          <CheckCircle2 className='mx-auto size-9 text-emerald-500' />
          <div className='space-y-1'>
            <h1 className='text-lg font-bold tracking-tight'>
              Booking request sent
            </h1>
            <p className='text-xs text-muted-foreground'>
              Ref{' '}
              <span className='font-mono text-foreground'>
                {appointment.id.slice(0, 8)}…
              </span>
              <span className='mx-1.5'>•</span>
              {appointment.patientName}
              {appointment.doctorName &&
                appointment.doctorName.toLowerCase() !==
                  appointment.patientName.toLowerCase() &&
                ` • Dr. ${appointment.doctorName}`}
              <span className='mx-1.5'>•</span>
              {when}
            </p>
          </div>

          {/* Getting-started checklist — compact next steps */}
          <div className='rounded-xl border bg-card p-4 text-left'>
            <div className='mb-3 flex items-center justify-between'>
              <h3 className='text-sm font-semibold'>Next steps</h3>
              {allDone ? (
                <span className='flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400'>
                  <PartyPopper className='size-3.5' />
                  All done!
                </span>
              ) : (
                <span className='text-xs text-muted-foreground'>
                  {doneCount} of {total} done
                </span>
              )}
            </div>
            <div className='mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted'>
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${allDone ? 'bg-emerald-500' : 'bg-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {allDone && (
              <p className='mb-3 rounded-md bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'>
                🎉 All set — present your QR at reception or track your booking after signing in.
              </p>
            )}
            <ul className='space-y-1'>
              {/* 1 — Request sent (always done, not toggleable) */}
              <li>
                <div className='flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm'>
                  <span className='flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'>
                    <Check className='size-3' strokeWidth={3} />
                  </span>
                  <span className='flex-1 text-muted-foreground line-through decoration-muted-foreground/40'>
                    Booking request sent
                  </span>
                  <span className='shrink-0 text-xs text-muted-foreground'>Ref {appointment.id.slice(0, 8)}</span>
                </div>
              </li>
              {/* 2 — Save ticket */}
              <li>
                <button
                  type='button'
                  onClick={() => {
                    if (!ticketDone) {
                      setTicketDone(true)
                      setShowQr(true)
                    } else {
                      setShowQr((v) => !v)
                    }
                  }}
                  className='flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60'
                >
                  <span className='flex size-5 shrink-0 items-center justify-center'>
                    {ticketDone ? (
                      <span className='flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground'>
                        <Check className='size-3' strokeWidth={3} />
                      </span>
                    ) : (
                      <Circle className='size-5 text-muted-foreground/40' />
                    )}
                  </span>
                  <span
                    className={`flex-1 transition-all duration-300 ${ticketDone ? 'text-muted-foreground line-through decoration-muted-foreground/40' : ''}`}
                  >
                    Save your ticket
                  </span>
                  {!ticketDone ? (
                    <span className='shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline'>
                      View
                    </span>
                  ) : (
                    <span className='flex items-center gap-1 shrink-0 text-xs text-muted-foreground'>
                      <QrCodeIcon className='size-3' />
                      {showQr ? 'Hide' : 'Show'}
                    </span>
                  )}
                </button>
              </li>
              {/* 3 — Create account */}
              <li>
                <button
                  type='button'
                  onClick={() => {
                    if (hasExistingAccount || accountCreated) return
                    setShowPassword((v) => !v)
                  }}
                  disabled={hasExistingAccount || accountCreated}
                  className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${hasExistingAccount || accountCreated ? '' : 'hover:bg-muted/60'}`}
                >
                  <span className='flex size-5 shrink-0 items-center justify-center'>
                    {hasExistingAccount || accountCreated ? (
                      <span className='flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground'>
                        <Check className='size-3' strokeWidth={3} />
                      </span>
                    ) : (
                      <Circle className='size-5 text-muted-foreground/40' />
                    )}
                  </span>
                  <span
                    className={`flex-1 transition-all duration-300 ${hasExistingAccount || accountCreated ? 'text-muted-foreground line-through decoration-muted-foreground/40' : ''}`}
                  >
                    {hasExistingAccount
                      ? 'Account ready'
                      : accountCreated
                        ? 'Account created'
                        : 'Create account to track'}
                  </span>
                  {!hasExistingAccount && !accountCreated && (
                    <span className='shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline'>
                      {showPassword ? 'Hide' : 'Set password'}
                    </span>
                  )}
                  {(hasExistingAccount || accountCreated) && (
                    <Link
                      to='/sign-in'
                      search={{ redirect: '/patient' }}
                      onClick={(e) => e.stopPropagation()}
                      className='shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline'
                    >
                      Sign in
                    </Link>
                  )}
                </button>
              </li>
            </ul>
          </div>

          {/* Expandable: QR ticket */}
          {showQr && (
            <QrTicket
              appointmentId={appointment.id}
              patientName={appointment.patientName}
              scheduledFor={appointment.scheduledFor}
              doctorName={appointment.doctorName}
            />
          )}

          {/* Expandable: password form */}
          {showPassword && !hasExistingAccount && !accountCreated && (
            <div className='rounded-xl border bg-muted/20 p-4 text-left'>
              <div className='flex items-center gap-2'>
                <KeyRound className='size-4 text-primary' />
                <p className='text-sm font-medium'>Set a password</p>
              </div>
              <p className='mt-1 text-xs text-muted-foreground'>
                Use {email} to sign in and track your booking.
              </p>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(onCreatePassword)}
                  className='mt-3 grid gap-3'
                  noValidate
                >
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
                  <Button type='submit' disabled={signUp.isPending}>
                    {signUp.isPending ? (
                      <Loader2 className='animate-spin' />
                    ) : (
                      <KeyRound />
                    )}
                    Create account
                  </Button>
                </form>
              </Form>
            </div>
          )}

          {accountCreated && (
            <p className='rounded-lg bg-emerald-50 px-3 py-2 text-left text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'>
              Account created — you can now sign in and track your appointment.
            </p>
          )}

          <p className='text-center text-xs text-muted-foreground'>
            The clinic reviews your request before it appears on the schedule.
          </p>

          <div className='flex gap-2'>
            {(hasExistingAccount || accountCreated) && (
              <Button asChild className='flex-1'>
                <Link to='/sign-in' search={{ redirect: '/patient' }}>
                  Sign in
                </Link>
              </Button>
            )}
            <Button
              variant={hasExistingAccount || accountCreated ? 'outline' : 'ghost'}
              onClick={onBookAnother}
              className='flex-1'
            >
              Book another
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
