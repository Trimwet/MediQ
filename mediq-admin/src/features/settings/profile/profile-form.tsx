import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { useClinicContext } from '@/lib/clinic-context'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const profileFormSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters.')
    .max(50, 'Name must not exceed 50 characters.'),
  phone: z
    .string()
    .min(7, 'Please enter a valid phone number.')
    .max(20, 'Phone must not exceed 20 characters.')
    .optional()
    .or(z.literal('')),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileData {
  full_name: string | null
  phone: string | null
  role: string
  created_at: string
}

interface DoctorData {
  specialization: string | null
  status: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function maskClinicId(id: string): string {
  return id.slice(0, 8)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileForm() {
  const user = useAuthStore((s) => s.auth.user)
  const { clinic } = useClinicContext()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [doctorInfo, setDoctorInfo] = useState<DoctorData | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  // Fetch profile + optional doctor row
  useEffect(() => {
    if (!user?.accountNo) return

    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, role, created_at')
        .eq('id', user!.accountNo)
        .single()

      if (cancelled) return

      if (error) {
        console.error('Failed to load profile:', error)
        toast.error('Could not load profile data.')
        setIsFetching(false)
        return
      }

      setProfile(data)

      // If the user has the doctor role, also fetch the doctors row
      const isDoctor =
        user!.role.includes('doctor') ||
        user!.clinicRole === 'doctor'

      if (isDoctor) {
        const { data: doc } = await supabase
          .from('doctors')
          .select('specialization, status')
          .eq('email', user!.email)
          .single()
        if (!cancelled && doc) setDoctorInfo(doc)
      }

      setIsFetching(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  // Derive default values once profile loads
  const defaultName = profile?.full_name || user?.email.split('@')[0] || 'Staff'
  const defaultPhone = profile?.phone || ''

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: defaultName,
      phone: defaultPhone,
    },
    mode: 'onChange',
  })

  // Reset form when profile data arrives
  useEffect(() => {
    if (profile && !isFetching) {
      form.reset({
        fullName: profile.full_name || user?.email.split('@')[0] || 'Staff',
        phone: profile.phone || '',
      })
    }
  }, [profile, isFetching])

  async function onSubmit(values: ProfileFormValues) {
    if (!user?.accountNo) return
    setIsSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: values.fullName,
        phone: values.phone || null,
      })
      .eq('id', user.accountNo)

    setIsSaving(false)

    if (error) {
      console.error('Profile update failed:', error)
      toast.error('Failed to update profile. Please try again.')
      return
    }

    toast.success('Profile updated successfully.')
  }

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (isFetching || !profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center gap-4'>
            <Skeleton className='h-16 w-16 rounded-full' />
            <div className='space-y-2'>
              <Skeleton className='h-4 w-40' />
              <Skeleton className='h-3 w-56' />
            </div>
          </div>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Skeleton className='h-4 w-20' />
              <Skeleton className='h-9 w-full' />
            </div>
            <div className='space-y-2'>
              <Skeleton className='h-4 w-12' />
              <Skeleton className='h-9 w-full' />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const displayName = profile.full_name || user?.email.split('@')[0] || 'Staff'
  const roleBadges = user?.role ?? []
  const clinicRoleLabel = user?.clinicRole
    ? user.clinicRole.replace('_', ' ')
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className='space-y-8'>
        {/* ── Read-only identity section ── */}
        <div className='flex items-start gap-4'>
          {/* Avatar with initials */}
          <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold'>
            {getInitials(displayName)}
          </div>

          <div className='space-y-3 min-w-0'>
            {/* Email */}
            <div className='space-y-1'>
              <Label className='text-muted-foreground'>Email</Label>
              <Input value={user?.email ?? ''} readOnly disabled className='max-w-md' />
            </div>

            {/* Badges row */}
            <div className='flex flex-wrap items-center gap-1.5'>
              {/* Role badges */}
              {roleBadges.map((r) => (
                <Badge key={r} variant='secondary'>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Badge>
              ))}

              {/* Clinic role badge (only if different from top-level role) */}
              {clinicRoleLabel &&
                !roleBadges.includes(user!.clinicRole!) && (
                  <Badge variant='outline'>{clinicRoleLabel}</Badge>
                )}

              {/* Clinic badge */}
              {clinic && (
                <Badge variant='outline'>
                  {clinic.clinicName}
                  <span className='ml-1 text-muted-foreground'>
                    ({maskClinicId(clinic.clinicId)})
                  </span>
                </Badge>
              )}

              {/* Doctor: specialization + status */}
              {doctorInfo?.specialization && (
                <Badge variant='secondary'>{doctorInfo.specialization}</Badge>
              )}
              {doctorInfo?.status && (
                <Badge
                  variant={
                    doctorInfo.status === 'active' ? 'default' : 'outline'
                  }
                >
                  {doctorInfo.status}
                </Badge>
              )}
            </div>

            {/* Member since */}
            {profile.created_at && (
              <p className='text-sm text-muted-foreground'>
                Member since {formatDate(profile.created_at)}
              </p>
            )}
          </div>
        </div>

        {/* ── Editable form ── */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4 max-w-md'
          >
            <FormField
              control={form.control}
              name='fullName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder='Your full name' {...field} />
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

            <Button type='submit' disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Update profile'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
