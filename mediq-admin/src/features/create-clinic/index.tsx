import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Building2, Check, Loader2 } from 'lucide-react'
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
  Form,
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

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const createClinicSchema = z.object({
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
  plan: z.enum(['starter', 'professional', 'enterprise'], {
    message: 'Please select a plan.',
  }),
})

type CreateClinicValues = z.infer<typeof createClinicSchema>

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

const plans = [
  { value: 'starter' as const, label: 'Starter — ₦15,000/mo' },
  { value: 'professional' as const, label: 'Professional — ₦50,000/mo' },
  { value: 'enterprise' as const, label: 'Enterprise — ₦150,000/mo' },
] as const

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
// Component
// ---------------------------------------------------------------------------

export function CreateClinic() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.auth.user)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slugStatus, setSlugStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const form = useForm<CreateClinicValues>({
    resolver: zodResolver(createClinicSchema),
    defaultValues: {
      clinicName: '',
      slug: '',
      plan: undefined,
    },
    mode: 'onChange',
  })

  const clinicName = form.watch('clinicName')
  const slug = form.watch('slug')
  const isSlugTouched = form.formState.touchedFields.slug

  // ── Auto-generate slug from clinic name ──────────────────────────────
  useEffect(() => {
    if (!clinicName || isSlugTouched) return
    const generated = generateSlug(clinicName)
    form.setValue('slug', generated, { shouldValidate: false })
  }, [clinicName, isSlugTouched])

  // ── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── Debounced slug availability check ────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!slug || slug.length < 3 || !createClinicSchema.shape.slug.safeParse(slug).success) {
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

  // ── Submit ───────────────────────────────────────────────────────────
  async function onSubmit(values: CreateClinicValues) {
    if (!user) {
      toast.error('You must be signed in to create a clinic.')
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.rpc('create_clinic', {
        p_name: values.clinicName.trim(),
        p_slug: values.slug.trim().toLowerCase(),
        p_plan: values.plan,
      })

      if (error) {
        const msg =
          error.message?.includes('duplicate') || error.message?.includes('unique')
            ? 'This slug is already taken. Please choose another.'
            : error.message || 'Failed to create clinic. Please try again.'
        toast.error(msg)
        return
      }

      toast.success('Clinic created successfully!')

      // If the RPC returns clinic metadata, update the auth store
      if (data && typeof data === 'object') {
        const clinicId = (data as Record<string, unknown>).clinic_id
        const clinicNameVal = (data as Record<string, unknown>).name
        if (clinicId) {
          useAuthStore.getState().auth.setClinic(
            String(clinicId),
            'admin',
            String(clinicNameVal || values.clinicName)
          )
        }
      }

      navigate({ to: '/admin/dashboard' })
    } catch (err) {
      console.error('Create clinic failed:', err)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Slug status indicator ────────────────────────────────────────────
  function SlugIndicator() {
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

  return (
    <div className='flex min-h-[calc(100svh-4rem)] items-center justify-center px-4 py-12'>
      <Card className='w-full max-w-lg'>
        <CardHeader className='text-center'>
          <div className='mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary'>
            <Building2 className='size-6' />
          </div>
          <CardTitle className='font-manrope text-xl font-bold tracking-tight sm:text-2xl'>
            Create your clinic
          </CardTitle>
          <CardDescription>
            Set up your workspace in 30 seconds
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-5'>
              {/* Clinic Name */}
              <FormField
                control={form.control}
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

              {/* Slug */}
              <FormField
                control={form.control}
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
                            form.trigger()
                          }}
                        />
                      </div>
                    </FormControl>
                    <SlugIndicator />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Plan */}
              <FormField
                control={form.control}
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

              {/* Submit */}
              <Button
                type='submit'
                className='w-full'
                size='lg'
                disabled={
                  isSubmitting ||
                  !form.formState.isValid ||
                  slugStatus === 'taken' ||
                  slugStatus === 'checking'
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className='size-4 animate-spin' />
                    Creating...
                  </>
                ) : (
                  'Create clinic & continue'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
