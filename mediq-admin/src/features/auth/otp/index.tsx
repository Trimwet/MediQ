import { useSearch } from '@tanstack/react-router'
import { AuthLayout } from '../auth-layout'
import { OtpForm } from './components/otp-form'

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  const visible = local.slice(0, 2)
  return `${visible}${'•'.repeat(Math.max(local.length - 2, 3))}@${domain}`
}

export function Otp() {
  const { email, purpose } = useSearch({ from: '/(auth)/otp' })
  if (!email || !purpose) return null

  const back =
    purpose === 'signin'
      ? { to: '/sign-in' as const, label: 'Back to sign in' }
      : purpose === 'signup'
        ? { to: '/sign-up' as const, label: 'Back to sign up' }
        : { to: '/forgot-password' as const, label: 'Back to forgot password' }

  const action =
    purpose === 'signin'
      ? 'finish signing in'
      : purpose === 'signup'
        ? 'finish creating your account'
        : 'reset your password'

  return (
    <AuthLayout
      title='Two-factor authentication'
      back={back}
      description={
        <>
          We sent a 6-digit code to{' '}
          <span className='font-medium text-foreground'>
            {maskEmail(email)}
          </span>
          . Enter it below to {action}.
        </>
      }
      footer={
        <span>
          Haven&apos;t received it? Check your spam folder, or use the
          resend button below.
        </span>
      }
    >
      <OtpForm email={email} purpose={purpose} />
    </AuthLayout>
  )
}