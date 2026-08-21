import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { sendOtp } from '@/lib/otp'
import { savePendingSignin } from '@/lib/pending-auth'
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

      // 2FA: revoke the pre-verification session, send a code to the email,
      // and hold the credentials until the code is verified on the OTP page.
      // The session is only re-issued (and the store populated) after
      // verification, so protected routes stay locked until then.
      await supabase.auth.signOut()

      await sendOtp({ email: data.email, purpose: 'signin' })
      savePendingSignin({ email: data.email, password: data.password, redirectTo })

      navigate({
        to: '/otp',
        search: { email: data.email, purpose: 'signin' },
      })
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
          {isLoading ? 'Sending verification code...' : 'Sign in'}
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
