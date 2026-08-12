import { Link, useSearch } from '@tanstack/react-router'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout
      title='Sign in'
      description={
        <>
          Enter your email and password to access your account. Don't have an
          account?{' '}
          <Link
            to='/sign-up'
            className='text-nowrap underline underline-offset-4 hover:text-primary'
          >
            Create one
          </Link>
        </>
      }
      footer={
        <>
          By clicking sign in, you agree to our{' '}
          <a
            href='/terms'
            className='underline underline-offset-4 hover:text-primary'
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href='/privacy'
            className='underline underline-offset-4 hover:text-primary'
          >
            Privacy Policy
          </a>
          .
        </>
      }
    >
      <UserAuthForm redirectTo={redirect} />
    </AuthLayout>
  )
}
