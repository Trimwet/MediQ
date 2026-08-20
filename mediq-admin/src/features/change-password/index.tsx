import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/assets/logo'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PasswordInput } from '@/components/password-input'
import { ThemeSwitch } from '@/components/theme-switch'

const formSchema = z
  .object({
    newPassword: z
      .string()
      .min(7, 'Password must be at least 7 characters long.'),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof formSchema>

export function ChangePassword() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  })

  // Route guard: must be signed in.
  useEffect(() => {
    if (!user) {
      navigate({ to: '/sign-in', replace: true })
    }
  }, [user, navigate])

  if (!user) return null

  async function onSubmit(values: FormValues) {
    const { error } = await supabase.auth.updateUser({
      password: values.newPassword,
    })
    if (error) {
      toast.error(error.message ?? 'Failed to update password.')
      return
    }
    toast.success('Password updated. Welcome to MediQ!')
    const target = user?.role.includes('patient')
      ? '/patient'
      : '/admin/dashboard'
    navigate({ to: target, replace: true })
  }

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='sm' asChild>
          <Link to='/' aria-label='Back to home'>
            <ArrowLeft className='size-4' />
          </Link>
        </Button>
        <Link to='/' aria-label='MediQ home'>
          <Logo className='h-10' />
        </Link>
        <ThemeSwitch />
      </div>

      <Card className='w-full max-w-sm'>
        <CardContent className='flex flex-col gap-4 pt-6'>
          <div className='flex flex-col items-center gap-2 text-center'>
            <KeyRound className='size-8 text-primary' />
            <h1 className='text-xl font-bold tracking-tight'>
              Change your password
            </h1>
            <p className='text-sm text-muted-foreground'>
              Choose a new password for your account.
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className='grid gap-3'
              noValidate
            >

              <FormField
                control={form.control}
                name='newPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
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
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
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
                className='mt-2'
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <KeyRound />
                )}
                Update password
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
