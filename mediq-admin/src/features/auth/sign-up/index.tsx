import { Link } from '@tanstack/react-router'
import { AuthLayout } from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'

const search = new URLSearchParams(window.location.search)
const isBusiness = search.get('business') === 'true'

export function SignUp() {
  return (
    <AuthLayout
      title={isBusiness ? 'Create your clinic account' : 'Create an account'}
      back={{ to: '/sign-in', label: 'Back to sign in' }}
      description={
        <>
          {isBusiness
            ? 'Set up your clinic and admin account in one step.'
            : 'Enter your email and password to get started.'}{' '}
          Already have an account?{' '}
          <Link
            to='/sign-in'
            className='text-nowrap underline underline-offset-4 hover:text-primary'
          >
            Sign in
          </Link>
        </>
      }
      footer={
        <>
          By creating an account, you agree to our{' '}
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
      <SignUpForm />
    </AuthLayout>
  )
}
