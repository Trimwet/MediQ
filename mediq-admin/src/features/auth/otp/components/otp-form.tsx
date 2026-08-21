import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { type OtpPurpose, resetPassword, sendOtp, verifyOtp } from '@/lib/otp'
import {
  clearPendingReset,
  clearPendingSignin,
  clearPendingSignup,
  getPendingSignin,
  getPendingSignup,
} from '@/lib/pending-auth'
import { useSignUp } from '@/data/hooks'
import { useAuthStore } from '@/stores/auth-store'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  otp: z
    .string()
    .min(6, 'Please enter the 6-digit code.')
    .max(6, 'Please enter the 6-digit code.'),
})

const resetSchema = z
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

interface OtpFormProps extends React.HTMLAttributes<HTMLFormElement> {
  email: string
  purpose: OtpPurpose
  /** Seconds to wait before the resend button re-enables. */
  resendCooldown?: number
}

export function OtpForm({
  email,
  purpose,
  resendCooldown = 60,
  className,
  ...props
}: OtpFormProps) {
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const signUp = useSignUp()
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendIn, setResendIn] = useState(resendCooldown)
  const [resetReady, setResetReady] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: '' },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const otp = form.watch('otp')

  // Countdown for the resend button so we respect the server cooldown.
  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  // Reset flow: the code is sent here (via Brevo) when the page loads,
  // because the forgot-password page only collects the email.
  const autoSentRef = useRef(false)
  useEffect(() => {
    if (purpose !== 'reset' || autoSentRef.current) return
    autoSentRef.current = true

    setIsResending(true)
    sendOtp({ email, purpose })
      .then(() => {
        setResendIn(resendCooldown)
        toast.success(`A new code was sent to ${email}.`)
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not send the code. Please try again.'
        )
      })
      .finally(() => setIsResending(false))
  }, [email, purpose, resendCooldown])

  async function completeSignIn() {
    const pending = getPendingSignin()
    if (!pending || pending.email.toLowerCase() !== email.toLowerCase()) {
      toast.error('Your sign-in session expired. Please sign in again.')
      navigate({ to: '/sign-in' })
      return
    }

    const { data: sessionData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password: pending.password,
      })

    if (authError || !sessionData.user) {
      throw authError ?? new Error('Could not sign you in. Please try again.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', sessionData.user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Could not load your profile. Please try again.')
    }

    const role = [String(profile.role)]

    const exp = sessionData.session?.expires_at
      ? sessionData.session.expires_at * 1000
      : Date.now() + 24 * 60 * 60 * 1000

    auth.setUser({
      accountNo: sessionData.user.id,
      email: sessionData.user.email ?? email,
      role,
      exp,
    })
    auth.setAccessToken(sessionData.session?.access_token ?? '')
    clearPendingSignin()

    const defaultPath = role.includes('patient')
      ? '/patient'
      : '/admin/dashboard'
    navigate({ to: pending.redirectTo || defaultPath, replace: true })
    toast.success(`Welcome back, ${profile.full_name || email}!`)
  }

  async function completeSignUp() {
    const pending = getPendingSignup()
    if (!pending || pending.email.toLowerCase() !== email.toLowerCase()) {
      toast.error('Your sign-up session expired. Please start again.')
      navigate({ to: '/sign-up' })
      return
    }

    await signUp.mutateAsync({
      email: pending.email,
      password: pending.password,
      ...(pending.name ? { name: pending.name } : {}),
      ...(pending.phone ? { phone: pending.phone } : {}),
    })
    clearPendingSignup()

    toast.success('Account created — sign in to continue.')
    navigate({
      to: '/sign-in',
      ...(pending.source === 'booking'
        ? { search: { redirect: '/patient' } }
        : {}),
    })
  }

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      await verifyOtp({ email, purpose, code: data.otp })
    } catch (error) {
      setIsLoading(false)
      form.reset()
      toast.error(
        error instanceof Error
          ? error.message
          : 'Invalid verification code. Please try again.'
      )
      return
    }

    try {
      if (purpose === 'signin') {
        await completeSignIn()
      } else if (purpose === 'signup') {
        await completeSignUp()
      } else {
        // Reset flow: code verified, now ask for the new password.
        setIsLoading(false)
        setResetReady(true)
      }
    } catch (error) {
      setIsLoading(false)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Verification succeeded but we could not finish. Please try again.'
      )
    }
  }

  async function handleResend() {
    setIsResending(true)
    try {
      await sendOtp({ email, purpose })
      setResendIn(resendCooldown)
      toast.success(`A new code was sent to ${email}.`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not resend the code. Please try again.'
      )
    } finally {
      setIsResending(false)
    }
  }

if (purpose === 'reset' && resetReady) {
    return <ResetPasswordForm email={email} className={className} />
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-2', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='otp'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='sr-only'>One-Time Password</FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  {...field}
                  containerClassName='justify-between sm:[&>[data-slot="input-otp-group"]>div]:w-10'
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={otp.length < 6 || isLoading}>
          {isLoading ? (
            <Loader2 className='animate-spin' />
          ) : (
            <ShieldCheck />
          )}
          {isLoading ? 'Verifying...' : 'Verify'}
        </Button>
        <Button
          type='button'
          variant='ghost'
          className='mt-1'
          onClick={handleResend}
          disabled={isResending || resendIn > 0}
        >
          {isResending ? (
            <Loader2 className='animate-spin' />
          ) : (
            <span>{resendIn > 0 ? `Resend code (${resendIn}s)` : 'Resend code'}</span>
          )}
        </Button>
      </form>
    </Form>
  )
}

interface ResetPasswordFormProps extends React.HTMLAttributes<HTMLDivElement> {
  email: string
}

/**
 * Second step of the password reset flow: shown after the OTP is verified.
 * Authorized server-side by the recently-consumed reset code.
 */
function ResetPasswordForm({ email, className, ...props }: ResetPasswordFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  async function onSubmit(data: z.infer<typeof resetSchema>) {
    setIsLoading(true)
    try {
      await resetPassword({ email, newPassword: data.newPassword })
      clearPendingReset()
      toast.success('Password updated — sign in with your new password.')
      navigate({ to: '/sign-in', replace: true })
    } catch (error) {
      setIsLoading(false)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not update the password. Please try again.'
      )
    }
  }

  return (
    <div className={cn('grid gap-2', className)} {...props}>
      <p className='text-sm text-muted-foreground'>
        Choose a new password for your account.
      </p>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='grid gap-2'
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
          <Button type='submit' className='mt-2' disabled={isLoading}>
            {isLoading ? (
              <Loader2 className='animate-spin' />
            ) : (
              <KeyRound />
            )}
            {isLoading ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </Form>
    </div>
  )
}