import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { UserAuthForm } from './user-auth-form'

const FORM_MESSAGES = {
  emailEmpty: 'Please enter your email.',
  passwordEmpty: 'Please enter your password.',
  passwordShort: 'Password must be at least 7 characters long.',
} as const

const navigate = vi.hoisted(() => vi.fn())
const signInMock = vi.hoisted(() => vi.fn())
const signOutMock = vi.hoisted(() => vi.fn())
const sendOtpMock = vi.hoisted(() => vi.fn())
const savePendingSigninMock = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children?: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className} {...rest}>
        {children}
      </a>
    ),
  }
})

// --- Supabase mocks ---
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  },
}))

vi.mock('@/lib/otp', () => ({
  sendOtp: (...args: unknown[]) => sendOtpMock(...args),
}))

vi.mock('@/lib/pending-auth', () => ({
  savePendingSignin: (...args: unknown[]) => savePendingSigninMock(...args),
}))

vi.mock('sonner', () => ({ toast: { error: toastError } }))

function mockValidCredentials() {
  signInMock.mockResolvedValue({
    data: {
      user: { id: 'user-123', email: 'a@b.com' },
      session: {
        access_token: 'test-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    error: null,
  })
  signOutMock.mockResolvedValue({ error: null })
  sendOtpMock.mockResolvedValue({
    message: 'Verification code sent.',
    expiresIn: 600,
    cooldown: 60,
  })
}

describe('UserAuthForm', () => {
  describe('Rendering without redirectTo', () => {
    let screen: RenderResult
    let emailInput: Locator
    let passwordInput: Locator
    let signInButton: Locator
    let forgotPasswordLink: Locator

    beforeEach(async () => {
      vi.clearAllMocks()
      mockValidCredentials()

      screen = await render(<UserAuthForm />)
      emailInput = screen.getByRole('textbox', { name: /^Email$/i })
      passwordInput = screen.getByLabelText(/^Password$/i)
      signInButton = screen.getByRole('button', { name: /^Sign in$/i })
      forgotPasswordLink = screen.getByText(/^Forgot password\?$/i)
    })

    it('renders fields, submit button, and forgot password link', async () => {
      await expect.element(emailInput).toBeInTheDocument()
      await expect.element(passwordInput).toBeInTheDocument()
      await expect.element(signInButton).toBeInTheDocument()
      await expect.element(forgotPasswordLink).toBeInTheDocument()
    })

    it('shows validation messages when submitting empty form', async () => {
      await userEvent.click(signInButton)

      await expect
        .element(screen.getByText(FORM_MESSAGES.emailEmpty))
        .toBeInTheDocument()
      await expect
        .element(screen.getByText(FORM_MESSAGES.passwordEmpty))
        .toBeInTheDocument()
    })

    it('validates credentials, sends an OTP, and routes to verification', async () => {
      await userEvent.fill(emailInput, 'a@b.com')
      await userEvent.fill(passwordInput, '1234567')

      await userEvent.click(signInButton)

      await vi.waitFor(() => expect(signInMock).toHaveBeenCalledOnce())
      expect(signInMock).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: '1234567',
      })

      // The pre-verification session is revoked so protected routes stay locked.
      await vi.waitFor(() => expect(signOutMock).toHaveBeenCalledOnce())

      await vi.waitFor(() =>
        expect(sendOtpMock).toHaveBeenCalledWith({
          email: 'a@b.com',
          purpose: 'signin',
        })
      )
      expect(savePendingSigninMock).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: '1234567',
        redirectTo: undefined,
      })

      await vi.waitFor(() =>
        expect(navigate).toHaveBeenCalledWith({
          to: '/otp',
          search: { email: 'a@b.com', purpose: 'signin' },
        })
      )
    })

    it('shows error toast on invalid credentials without sending an OTP', async () => {
      vi.clearAllMocks()
      signInMock.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      await userEvent.fill(emailInput, 'a@b.com')
      await userEvent.fill(passwordInput, '1234567')

      await userEvent.click(signInButton)

      await vi.waitFor(() => expect(signInMock).toHaveBeenCalledOnce())
      expect(sendOtpMock).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
    })
  })

  it('carries the redirect target into the pending sign-in', async () => {
    vi.clearAllMocks()
    mockValidCredentials()

    const { getByRole, getByLabelText } = await render(
      <UserAuthForm redirectTo='/patient' />
    )

    await userEvent.fill(getByRole('textbox', { name: /Email/i }), 'a@b.com')
    await userEvent.fill(getByLabelText('Password'), '1234567')

    await userEvent.click(getByRole('button', { name: /Sign in/i }))

    await vi.waitFor(() =>
      expect(savePendingSigninMock).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: '1234567',
        redirectTo: '/patient',
      })
    )
  })
})