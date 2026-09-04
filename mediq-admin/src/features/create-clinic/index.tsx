import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { Logo } from '@/assets/logo'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Check, Loader2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PasswordInput } from '@/components/password-input'

// ---------------------------------------------------------------------------
// URL plan helper
// ---------------------------------------------------------------------------

function getInitialPlan(): 'free' | 'starter' | 'professional' | 'enterprise' {
  if (typeof window === 'undefined') return 'free'
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('plan')
  if (raw === 'free' || raw === 'starter' || raw === 'professional' || raw === 'enterprise') {
    return raw
  }
  return 'free'
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

const plans = [
  { value: 'free' as const, label: 'Free — ₦0/mo' },
  { value: 'starter' as const, label: 'Starter — ₦15,000/mo' },
  { value: 'professional' as const, label: 'Professional — ₦50,000/mo' },
  { value: 'enterprise' as const, label: 'Enterprise — ₦150,000/mo' },
] as const

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Full combined schema for unauthenticated users (account + clinic). */
const combinedSchema = z
  .object({
    name: z.string().min(2, 'Please enter your full name.'),
    phone: z.string().min(7, 'Please enter a valid phone number.'),
    email: z.email({
      error: (iss) =>
        iss.input === '' ? 'Please enter your email.' : undefined,
    }),
    password: z
      .string()
      .min(1, 'Please enter your password.')
      .min(7, 'Password must be at least 7 characters long.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
    clinicName: z
      .string()
      .min(2, 'Clinic name must be at least 2 characters.')
      .max(80, 'Clinic name must not exceed 80 characters.'),
    slug: z
      .string()
      .min(3, 'Slug must be at least 3 characters.')
      .max(63, 'Slug must not exceed 63 characters.')
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        'Slug can only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens).'
      ),
    plan: z.enum(['free', 'starter', 'professional', 'enterprise'], {
      message: 'Please select a plan.',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

/** Clinic-only schema for already-authenticated users. */
const clinicOnlySchema = z.object({
  clinicName: z
    .string()
    .min(2, 'Clinic name must be at least 2 characters.')
    .max(80, 'Clinic name must not exceed 80 characters.'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters.')
    .max(63, 'Slug must not exceed 63 characters.')
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      'Slug can only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens).'
    ),
  plan: z.enum(['free', 'starter', 'professional', 'enterprise'], {
    message: 'Please select a plan.',
  }),
})

type CombinedValues = z.infer<typeof combinedSchema>
type ClinicOnlyValues = z.infer<typeof clinicOnlySchema>

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63)
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SlugIndicator({
  slugStatus,
  slug,
}: {
  slugStatus: 'idle' | 'checking' | 'available' | 'taken'
  slug: string
}) {
  if (slugStatus === 'idle' || slug.length < 3) return null

  return (
    <p
      className={cn(
        'mt-1.5 flex items-center gap-1.5 text-xs font-medium',
        slugStatus === 'checking' && 'text-muted-foreground',
        slugStatus === 'available' && 'text-emerald-600',
        slugStatus === 'taken' && 'text-destructive'
      )}
    >
      {slugStatus === 'checking' && (
        <>
          <Loader2 className='size-3 animate-spin' />
          Checking availability...
        </>
      )}
      {slugStatus === 'available' && (
        <>
          <Check className='size-3' />
          Available
        </>
      )}
      {slugStatus === 'taken' && (
        <>
          <span className='size-1.5 rounded-full bg-destructive' />
          Already taken
        </>
      )}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Hook: slug auto-generation + debounced availability check
// ---------------------------------------------------------------------------

function useSlugField(
  watch: (name: string) => string,
  isSlugTouched: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: any,
  schema: typeof clinicOnlySchema.shape.slug | typeof combinedSchema.shape.slug
) {
  const [slugStatus, setSlugStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const clinicName = watch('clinicName')
  const slug = watch('slug')

  // Auto-generate slug from clinic name
  useEffect(() => {
    if (!clinicName || isSlugTouched) return
    const generated = generateSlug(clinicName)
    setValue('slug', generated, { shouldValidate: false })
  }, [clinicName, isSlugTouched, setValue])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Debounced slug availability check with 3 s timeout
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!slug || slug.length < 3 || !schema.safeParse(slug).success) {
      setSlugStatus('idle')
      return
    }

    setSlugStatus('checking')

    const controller = new AbortController()

    debounceRef.current = setTimeout(async () => {
      try {
        const query = supabase
          .from('clinics')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()

        // Race the real query against a 3-second timeout
        const result = await Promise.race([
          query,
          new Promise<{ data: null; error: Error }>((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: null,
                  error: new Error('Slug check timed out'),
                }),
              3000
            )
          ),
        ])

        if (!mountedRef.current || controller.signal.aborted) return

        if (result.error) {
          console.error('Slug check failed / timed out:', result.error.message)
          setSlugStatus('idle')
          return
        }

        setSlugStatus(result.data ? 'taken' : 'available')
      } catch (err) {
        if (!mountedRef.current) return
        console.error('Slug check error:', err)
        setSlugStatus('idle')
      }
    }, 400)

    return () => {
      controller.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [slug, schema])

  return { slugStatus, slug }
}

// ---------------------------------------------------------------------------
// Combined form (unauthenticated)
// ---------------------------------------------------------------------------

function CombinedForm() {
  const navigate = useNavigate()
  const setClinic = useAuthStore((s) => s.auth.setClinic)
  const setUser = useAuthStore((s) => s.auth.setUser)
  const setAccessToken = useAuthStore((s) => s.auth.setAccessToken)
  const [isLoading, setIsLoading] = useState(false)

  const methods = useForm<CombinedValues>({
    resolver: zodResolver(combinedSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      clinicName: '',
      slug: '',
      plan: getInitialPlan(),
    },
    mode: 'onChange',
  })

  const isSlugTouched = !!methods.formState.touchedFields.slug
  const { slugStatus, slug } = useSlugField(
    methods.watch,
    isSlugTouched,
    methods.setValue,
    combinedSchema.shape.slug
  )

  async function onSubmit(data: CombinedValues) {
    setIsLoading(true)

    try {
      // Step 1: Create Supabase auth account
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              name: data.name,
              phone: data.phone,
            },
          },
        })

      if (signUpError) {
        const msg = signUpError.message?.includes('already')
          ? 'An account with this email already exists. Please sign in instead.'
          : signUpError.message || 'Failed to create account. Please try again.'
        toast.error(msg)
        setIsLoading(false)
        return
      }

      if (!signUpData.user) {
        toast.error('Sign-up failed — no user returned.')
        setIsLoading(false)
        return
      }

      // Step 2: Wait for session to persist
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        try {
          localStorage.setItem(
            'mediq_pending_clinic',
            JSON.stringify({
              clinicName: data.clinicName,
              slug: data.slug,
              plan: data.plan,
              email: data.email,
            })
          )
        } catch {}
        toast.success(
          'Account created! Please check your email to verify, then sign in — your clinic details are saved and will be created when you return.'
        )
        navigate({ to: '/sign-in' })
        setIsLoading(false)
        return
      }

      // Step 3: Create the clinic
      const { data: clinicData, error: clinicError } = await supabase.rpc(
        'create_clinic',
        {
          p_name: data.clinicName.trim(),
          p_slug: data.slug.trim().toLowerCase(),
          p_plan: data.plan,
        }
      )

      if (clinicError) {
        const msg =
          clinicError.message?.includes('duplicate') ||
          clinicError.message?.includes('unique') ||
          (clinicError as unknown as Record<string, unknown>).code === '23505'
            ? 'This slug is already taken. Please choose another.'
            : clinicError.message ||
              'Failed to create clinic. Please try again.'
        toast.error(msg)
        setIsLoading(false)
        return
      }

      // Step 4: Hydrate the auth store — setClinic requires auth.user to be
      // non-null, so we must call setUser first for brand-new registrations.
      const session = sessionData.session
      const exp = session?.expires_at
        ? session.expires_at * 1000
        : Date.now() + 24 * 60 * 60 * 1000

      setUser({
        accountNo: signUpData.user!.id,
        email: signUpData.user!.email ?? data.email,
        role: ['admin'],
        exp,
      })
      setAccessToken(session?.access_token ?? '')

      if (clinicData && typeof clinicData === 'object') {
        // create_clinic returns a clinics row — field is `id`, not `clinic_id`
        const clinicId = (clinicData as Record<string, unknown>).id
        const clinicNameVal = (clinicData as Record<string, unknown>).name
        if (clinicId) {
          setClinic(
            String(clinicId),
            'admin',
            String(clinicNameVal || data.clinicName)
          )
        }
      }

      toast.success('Account and clinic created successfully!')
      navigate({ to: '/admin/dashboard' })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'An unexpected error occurred.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const isFormSubmitting = isLoading || slugStatus === 'taken'

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className='space-y-5'
      >
        {/* ── Your Account ────────────────────────────────────────── */}
        <div>
          <h3 className='text-sm font-semibold text-foreground'>
            Your account
          </h3>
          <p className='text-xs text-muted-foreground'>
            You will be the admin of your new clinic.
          </p>
        </div>

        <FormField
          control={methods.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder='eg: Aisha Bello' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={methods.control}
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
          control={methods.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={methods.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='••••••••' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={methods.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='••••••••' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Divider ─────────────────────────────────────────────── */}
        <div className='relative my-1'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-card px-2 text-muted-foreground'>
              Clinic details
            </span>
          </div>
        </div>

        {/* ── Your Clinic ─────────────────────────────────────────── */}
        <FormField
          control={methods.control}
          name='clinicName'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Clinic name</FormLabel>
              <FormControl>
                <Input
                  placeholder='e.g. City General Hospital'
                  autoComplete='organization'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={methods.control}
          name='slug'
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL slug</FormLabel>
              <FormControl>
                <div className='flex items-center rounded-md border border-input bg-muted/50 text-sm'>
                  <span className='px-3 text-muted-foreground select-none'>
                    mediq.app/
                  </span>
                  <Input
                    className='border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0'
                    placeholder='clinic-name'
                    autoComplete='off'
                    {...field}
                    onBlur={() => {
                      field.onBlur()
                      methods.trigger()
                    }}
                  />
                </div>
              </FormControl>
              <SlugIndicator slugStatus={slugStatus} slug={slug} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={methods.control}
          name='plan'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plan</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Choose a plan' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Submit ─────────────────────────────────────────────── */}
        <Button
          type='submit'
          className='w-full'
          size='lg'
          disabled={isFormSubmitting || !methods.formState.isValid}
        >
          {isLoading ? (
            <>
              <Loader2 className='size-4 animate-spin' />
              Creating account &amp; clinic...
            </>
          ) : (
            <>
              <UserPlus className='size-4' />
              Create account &amp; clinic
            </>
          )}
        </Button>

        {/* ── Sign-in link ───────────────────────────────────────── */}
        <p className='text-center text-sm text-muted-foreground'>
          Already have an account?{' '}
          <Link to='/sign-in' className='font-medium text-primary hover:underline'>
            Sign in
          </Link>
        </p>
      </form>
    </FormProvider>
  )
}

// ---------------------------------------------------------------------------
// Clinic-only form (authenticated)
// ---------------------------------------------------------------------------

function ClinicOnlyForm() {
  const navigate = useNavigate()
  const setClinic = useAuthStore((s) => s.auth.setClinic)
  const user = useAuthStore((s) => s.auth.user)
  const [isLoading, setIsLoading] = useState(false)

  const methods = useForm<ClinicOnlyValues>({
    resolver: zodResolver(clinicOnlySchema),
    defaultValues: {
      clinicName: '',
      slug: '',
      plan: getInitialPlan(),
    },
    mode: 'onChange',
  })

  // Restore pending clinic if user just verified email after CombinedForm
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mediq_pending_clinic')
      if (!raw || !user?.email) return
      const pending = JSON.parse(raw) as { clinicName: string; slug: string; plan: string; email: string }
      if (pending.email.toLowerCase() !== user.email.toLowerCase()) return
      if (!methods.getValues('clinicName')) methods.setValue('clinicName', pending.clinicName)
      if (!methods.getValues('slug')) methods.setValue('slug', pending.slug)
      if (pending.plan) methods.setValue('plan', pending.plan as ClinicOnlyValues['plan'])
      localStorage.removeItem('mediq_pending_clinic')
      toast.info('Your clinic details were restored — review and submit to create it.')
    } catch {}
  }, [user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  const isSlugTouched = !!methods.formState.touchedFields.slug
  const { slugStatus, slug } = useSlugField(
    methods.watch,
    isSlugTouched,
    methods.setValue,
    clinicOnlySchema.shape.slug
  )

  async function onSubmit(data: ClinicOnlyValues) {
    setIsLoading(true)

    try {
      const { data: clinicData, error } = await supabase.rpc('create_clinic', {
        p_name: data.clinicName.trim(),
        p_slug: data.slug.trim().toLowerCase(),
        p_plan: data.plan,
      })

      if (error) {
        const msg =
          error.message?.includes('duplicate') ||
          error.message?.includes('unique') ||
          (error as unknown as Record<string, unknown>).code === '23505'
            ? 'This slug is already taken. Please choose another.'
            : error.message || 'Failed to create clinic. Please try again.'
        toast.error(msg)
        setIsLoading(false)
        return
      }

      if (clinicData && typeof clinicData === 'object') {
        // create_clinic returns a clinics row — field is `id`, not `clinic_id`
        const clinicId = (clinicData as Record<string, unknown>).id
        const clinicNameVal = (clinicData as Record<string, unknown>).name
        if (clinicId) {
          setClinic(
            String(clinicId),
            'admin',
            String(clinicNameVal || data.clinicName)
          )
        }
      }

      toast.success('Clinic created successfully!')
      navigate({ to: '/admin/dashboard' })
    } catch (err) {
      console.error('Create clinic failed:', err)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const isFormSubmitting = isLoading || slugStatus === 'taken'

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className='space-y-5'
      >
        <FormField
          control={methods.control}
          name='clinicName'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Clinic name</FormLabel>
              <FormControl>
                <Input
                  placeholder='e.g. City General Hospital'
                  autoComplete='organization'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={methods.control}
          name='slug'
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL slug</FormLabel>
              <FormControl>
                <div className='flex items-center rounded-md border border-input bg-muted/50 text-sm'>
                  <span className='px-3 text-muted-foreground select-none'>
                    mediq.app/
                  </span>
                  <Input
                    className='border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0'
                    placeholder='clinic-name'
                    autoComplete='off'
                    {...field}
                    onBlur={() => {
                      field.onBlur()
                      methods.trigger()
                    }}
                  />
                </div>
              </FormControl>
              <SlugIndicator slugStatus={slugStatus} slug={slug} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={methods.control}
          name='plan'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plan</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Choose a plan' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type='submit'
          className='w-full'
          size='lg'
          disabled={isFormSubmitting || !methods.formState.isValid}
        >
          {isLoading ? (
            <>
              <Loader2 className='size-4 animate-spin' />
              Creating...
            </>
          ) : (
            'Create clinic & continue'
          )}
        </Button>
      </form>
    </FormProvider>
  )
}

// ---------------------------------------------------------------------------
// Main component: picks form based on auth state
// ---------------------------------------------------------------------------

export function CreateClinic() {
  const user = useAuthStore((s) => s.auth.user)

  return (
    <div className='flex min-h-[calc(100svh-4rem)] items-center justify-center px-4 py-12'>
      <Card className='w-full max-w-lg'>
        <CardHeader className='text-center'>
          <Link to='/' aria-label='MediQ home' className='mx-auto mb-3 flex justify-center'>
            <Logo className='h-9' />
          </Link>
          <CardTitle className='font-manrope text-xl font-bold tracking-tight sm:text-2xl'>
            {user ? 'Create your clinic' : 'Get started with MediQ'}
          </CardTitle>
          <CardDescription>
            {user
              ? 'Set up your workspace in 30 seconds'
              : 'Create your account and clinic in one step'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {user ? <ClinicOnlyForm /> : <CombinedForm />}
        </CardContent>
      </Card>
    </div>
  )
}
