import { Link } from '@tanstack/react-router'
import { AuthLayout } from '../auth-layout'
import { OtpForm } from './components/otp-form'

export function Otp() {
  return (
    <AuthLayout
      title='Two-factor authentication'
      back={{ to: '/forgot-password', label: 'Back to forgot password' }}
      description='Enter the authentication code we sent to your email.'
      footer={
        <>
          Haven't received it?{' '}
          <Link
            to='/sign-in'
            className='underline underline-offset-4 hover:text-primary'
          >
            Resend a new code
          </Link>
        </>
      }
    >
      <OtpForm />
    </AuthLayout>
  )
}
