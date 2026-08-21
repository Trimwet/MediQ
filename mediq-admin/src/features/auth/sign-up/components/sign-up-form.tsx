import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { authRepository } from '@/data'
import { Check, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
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
// Business-mode detection from URL
// ---------------------------------------------------------------------------

const urlParams = new URLSearchParams(window.location.search)
const isBusiness = urlParams.get('business') === 'true'
const initialPlan = urlParams.get('plan') as
  | 'free'
  | 'starter'
  | 'professional'
  | 'enterprise'
  | null

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
// Schema
// ---------------------------------------------------------------------------

const baseSchema = z
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
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

const businessSchema = z
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

type PatientFormValues = z.infer<typeof baseSchema>
type BusinessFormValues = z.infer<typeof businessSchema>

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
// Shared sub-components (useFormContext — no control prop needed)
// ---------------------------------------------------------------------------

function UserFields() {
  return (
    <>
      <FormField
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
    </>
  )
}

// ---------------------------------------------------------------------------
// Slug indicator (used inside business form)
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
// Patient form (existing flow)
// ---------------------------------------------------------------------------

function PatientSignUpForm({
  className,
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const methods = useForm<PatientFormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  function onSubmit(data: PatientFormValues) {
    setIsLoading(true)

    const promise = authRepository.signUp({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone,
    })

    toast.promise(promise, {
      loading: 'Creating account...',
      success: () => {
        setIsLoading(false)
        navigate({ to: '/sign-in' })
        return `Account created for ${data.email}. Sign in to continue.`
      },
      error: (error) => {
        setIsLoading(false)
        return error instanceof Error
          ? error.message
          : 'Error creating account.'
      },
    })
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
      >
        <UserFields />
        <Button className='mt-3' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <UserPlus />}
          Create Account
        </Button>
      </form>
    </FormProvider>
  )
}

// ---------------------------------------------------------------------------
// Business form (account + clinic in one submit)
// ---------------------------------------------------------------------------

function BusinessSignUpForm({
  className,
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)
  const [slugStatus, setSlugStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle')
  const navigate = useNavigate()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const methods = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      clinicName: '',
      slug: '',
      plan: initialPlan || 'free',
    },
    mode: 'onChange',
  })

  const clinicName = methods.watch('clinicName')
  const slug = methods.watch('slug')
  const isSlugTouched = methods.formState.touchedFields.slug

  // Auto-generate slug from clinic name
  useEffect(() => {
    if (!clinicName || isSlugTouched) return
    const generated = generateSlug(clinicName)
    methods.setValue('slug', generated, { shouldValidate: false })
  }, [clinicName, isSlugTouched])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Debounced slug availability check
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!slug || slug.length < 3 || !businessSchema.shape.slug.safeParse(slug).success) {
      setSlugStatus('idle')
      return
    }

    setSlugStatus('checking')

    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      if (!mountedRef.current) return

      if (error) {
        console.error('Slug check failed:', error)
        setSlugStatus('idle')
        return
      }

      setSlugStatus(data ? 'taken' : 'available')
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [slug])

  // Submit
  async function onSubmit(data: BusinessFormValues) {
    setIsLoading(true)

    try {
      // Step 1: Create user account
      await authRepository.signUp({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
      })

      // Step 2: Create the clinic (session should be active after signUp)
      await new Promise((r) => setTimeout(r, 500))

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
          clinicError.message?.includes('unique')
            ? 'This slug is already taken. Please choose another.'
            : clinicError.message || 'Failed to create clinic. Please try again.'
        toast.error(msg)
        setIsLoading(false)
        return
      }

      // Update auth store with clinic context
      if (clinicData && typeof clinicData === 'object') {
        const clinicId = (clinicData as Record<string, unknown>).clinic_id
        const clinicNameVal = (clinicData as Record<string, unknown>).name
        if (clinicId) {
          useAuthStore.getState().auth.setClinic(
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
        error instanceof Error ? error.message : 'Error creating account.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const isFormSubmitting =
    isLoading || slugStatus === 'taken' || slugStatus === 'checking'

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
      >
        <p className='text-sm text-muted-foreground -mb-2'>
          You'll be the admin of your new clinic.
        </p>

        {/* User fields */}
        <UserFields />

        {/* Clinic fields */}
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

        <FormField
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
          className='mt-3'
          disabled={isFormSubmitting}
        >
          {isLoading ? (
            <Loader2 className='animate-spin' />
          ) : (
            <UserPlus />
          )}
          Create account &amp; clinic
        </Button>
      </form>
    </FormProvider>
  )
}

// ---------------------------------------------------------------------------
// Exported: picks the right form based on URL
// ---------------------------------------------------------------------------

export function SignUpForm(props: React.HTMLAttributes<HTMLFormElement>) {
  return isBusiness ? (
    <BusinessSignUpForm {...props} />
  ) : (
    <PatientSignUpForm {...props} />
  )
}
