import { useMemo, useState } from 'react'
import { z } from 'zod'
import { format, startOfDay, isSameDay } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { type BookingResult } from '@/data'
import { useBookAppointment, useDoctors } from '@/data/hooks'
import { sendOtp } from '@/lib/otp'
import { savePendingSignup } from '@/lib/pending-auth'
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
  doctorId: z.string().optional(),
  date: z.date({ message: 'Please choose a date.' }),
  time: z.string().min(1, 'Please choose a time.'),
  reason: z.string().max(300).optional(),
})

type FormValues = z.infer<typeof formSchema>

export function Booking() {
  const [result, setResult] = useState<BookingResult | null>(null)
  const book = useBookAppointment()
  const doctorsQuery = useDoctors()

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

  const activeDoctors = (doctorsQuery.data ?? []).filter(
    (d) => d.status === 'active'
  )

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
      },
      {
        onSuccess: (bookingResult) => {
          setResult(bookingResult)
          form.reset()
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
  const [isSendingCode, setIsSendingCode] = useState(false)
  const navigate = useNavigate()
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

  async function onCreatePassword(values: PasswordValues) {
    // 2FA: send a code to the booking email first. The account is only
    // created after the code is verified on the OTP page.
    setIsSendingCode(true)
    try {
      await sendOtp({ email, purpose: 'signup' })
      savePendingSignup({
        email,
        password: values.password,
        source: 'booking',
      })

      navigate({
        to: '/otp',
        search: { email, purpose: 'signup' },
      })
    } catch (error) {
      setIsSendingCode(false)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not send the verification code. Please try again.'
      )
    }
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

          {hasAccount ? (
            <div className='flex flex-col gap-2'>
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
                We use the email you provided. Set a password now to sign in
                and track your booking — we&apos;ll send a verification code to
                your email to confirm it.
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
                    disabled={isSendingCode}
                  >
                    {isSendingCode ? (
                      <Loader2 className='animate-spin' />
                    ) : (
                      <KeyRound />
                    )}
                    {isSendingCode
                      ? 'Sending verification code...'
                      : 'Send code & create account'}
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
