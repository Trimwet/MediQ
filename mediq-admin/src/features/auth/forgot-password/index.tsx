import { Link } from '@tanstack/react-router'
import { AuthLayout } from '../auth-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'

export function ForgotPassword() {
  return (
    <AuthLayout
      title='Forgot password'
      back={{ to: '/sign-in', label: 'Back to sign in' }}
      description='Enter your registered email and we will send you a verification code to reset your password.'
      footer={
        <>
          Don't have an account?{' '}
          <Link
            to='/sign-up'
            className='underline underline-offset-4 hover:text-primary'
          >
            Sign up
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
