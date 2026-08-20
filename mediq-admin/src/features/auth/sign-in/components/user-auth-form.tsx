import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter your email.' : undefined),
  }),
  password: z
    .string()
    .min(1, 'Please enter your password.')
    .min(7, 'Password must be at least 7 characters long.'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      const { data: sessionData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })

      if (authError || !sessionData.user) {
        setIsLoading(false)
        const msg = authError?.message ?? ''
        if (msg.includes('Invalid login credentials')) {
          toast.error(
            "Wrong email or password. If you haven't signed up yet, create an account first."
          )
        } else if (msg.includes('Email not confirmed')) {
          toast.error(
            'Please confirm your email address before signing in. Check your inbox for the confirmation link.'
          )
        } else {
          toast.error(msg || 'Could not sign you in. Please try again.')
        }
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', sessionData.user.id)
        .single()

      if (profileError || !profile) {
        setIsLoading(false)
        toast.error('Could not load your profile. Please try again.')
        return
      }

      const role = [String(profile.role)]

      const exp =
        sessionData.session?.expires_at
          ? sessionData.session.expires_at * 1000
          : Date.now() + 24 * 60 * 60 * 1000

      auth.setUser({
        accountNo: sessionData.user.id,
        email: sessionData.user.email ?? data.email,
        role,
        exp,
      })
      auth.setAccessToken(sessionData.session?.access_token ?? '')

      const defaultPath = role.includes('patient')
        ? '/patient'
        : '/admin/dashboard'
      const targetPath = redirectTo || defaultPath
      navigate({ to: targetPath, replace: true })

      toast.success(`Welcome back, ${profile.full_name || data.email}!`)
    } catch {
      setIsLoading(false)
      toast.error('An unexpected error occurred. Please try again.')
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-4', className)}
        {...props}
      >
        <FormField
          control={form.control}
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
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='••••••••' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='absolute inset-e-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-3' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>
        <p className='text-center text-sm text-muted-foreground'>
          Visiting as a patient?{' '}
          <Link
            to='/book'
            className='font-medium text-primary underline-offset-4 hover:underline'
          >
            Book an appointment — no account needed
          </Link>
        </p>
      </form>
    </Form>
  )
}
