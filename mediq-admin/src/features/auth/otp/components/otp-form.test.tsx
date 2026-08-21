import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { OtpForm } from './otp-form'

const navigate = vi.hoisted(() => vi.fn())
const verifyOtpMock = vi.hoisted(() => vi.fn())
const sendOtpMock = vi.hoisted(() => vi.fn())
const resetPasswordMock = vi.hoisted(() => vi.fn())
const signUpMock = vi.hoisted(() => vi.fn())
const signInMock = vi.hoisted(() => vi.fn())
const setUserMock = vi.hoisted(() => vi.fn())
const setAccessTokenMock = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())
const clearPendingResetMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('@/lib/otp', () => ({
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
  sendOtp: (...args: unknown[]) => sendOtpMock(...args),
  resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
}))

const pendingState = vi.hoisted(() => ({
  signup: null as Record<string, unknown> | null,
  signin: null as Record<string, unknown> | null,
}))

vi.mock('@/lib/pending-auth', () => ({
  getPendingSignup: () => pendingState.signup,
  clearPendingSignup: () => {
    pendingState.signup = null
  },
  getPendingSignin: () => pendingState.signin,
  clearPendingSignin: () => {
    pendingState.signin = null
  },
  clearPendingReset: () => clearPendingResetMock(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInMock(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: { role: 'admin', full_name: 'Test User' },
              error: null,
            }),
        }),
      }),
    }),
  },
}))

vi.mock('@/data/hooks', () => ({
  useSignUp: () => ({ mutateAsync: (...args: unknown[]) => signUpMock(...args) }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    auth: { setUser: setUserMock, setAccessToken: setAccessTokenMock },
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}))

describe('OtpForm', () => {
  let screen: RenderResult
  let otpInput: Locator
  let verifyButton: Locator
  let resendButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()
    pendingState.signup = null
    pendingState.signin = null
    verifyOtpMock.mockResolvedValue({
      valid: true,
      message: 'Verification successful.',
    })
    sendOtpMock.mockResolvedValue({
      message: 'Verification code sent.',
      expiresIn: 600,
      cooldown: 60,
    })

    screen = await render(
      <OtpForm email='a@b.com' purpose='signup' resendCooldown={0} />
    )
    otpInput = screen.getByLabelText(/^One-Time Password$/i)
    verifyButton = screen.getByRole('button', { name: /^Verify$/i })
    resendButton = screen.getByRole('button', { name: /^Resend code$/i })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('disables Verify until 6 digits are entered', async () => {
    await expect.element(verifyButton).toBeDisabled()

    await userEvent.fill(otpInput, '12345')
    await expect.element(verifyButton).toBeDisabled()

    await userEvent.fill(otpInput, '123456')
    await expect.element(verifyButton).toBeEnabled()
  })

  it('verifies the code and creates the pending account on sign-up', async () => {
    pendingState.signup = {
      email: 'a@b.com',
      password: '1234567',
      name: 'Aisha Bello',
      phone: '+2348000000000',
      source: 'sign-up',
    }
    signUpMock.mockResolvedValue({ email: 'a@b.com', role: ['patient'] })

    await userEvent.fill(otpInput, '123456')
    await userEvent.click(verifyButton)

    await vi.waitFor(() =>
      expect(verifyOtpMock).toHaveBeenCalledWith({
        email: 'a@b.com',
        purpose: 'signup',
        code: '123456',
      })
    )
    await vi.waitFor(() => expect(signUpMock).toHaveBeenCalledOnce())
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: '1234567',
      name: 'Aisha Bello',
      phone: '+2348000000000',
    })
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/sign-in' })
    )
    expect(pendingState.signup).toBeNull()
  })

  it('redirects to sign-up when the pending sign-up is missing', async () => {
    await userEvent.fill(otpInput, '123456')
    await userEvent.click(verifyButton)

    await vi.waitFor(() => expect(verifyOtpMock).toHaveBeenCalledOnce())
    expect(signUpMock).not.toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/sign-up' })
    )
  })

  it('shows an error toast on an invalid code and allows retry', async () => {
    verifyOtpMock.mockRejectedValue(new Error('Invalid verification code.'))

    await userEvent.fill(otpInput, '123456')
    await userEvent.click(verifyButton)

    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Invalid verification code.')
    )
    expect(signUpMock).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()

    // The code was cleared, so Verify is disabled again until retyped.
    await expect.element(verifyButton).toBeDisabled()
  })

  it('resends the code when the resend button is clicked', async () => {
    await userEvent.click(resendButton)

    await vi.waitFor(() =>
      expect(sendOtpMock).toHaveBeenCalledWith({
        email: 'a@b.com',
        purpose: 'signup',
      })
    )
    await vi.waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'A new code was sent to a@b.com.'
      )
    )
  })
})

describe('OtpForm (sign-in)', () => {
  it('completes the pending sign-in after verification', async () => {
    pendingState.signin = {
      email: 'a@b.com',
      password: '1234567',
      redirectTo: undefined,
    }
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

    const { getByLabelText, getByRole } = await render(
      <OtpForm email='a@b.com' purpose='signin' resendCooldown={0} />
    )

    await userEvent.fill(getByLabelText(/^One-Time Password$/i), '123456')
    await userEvent.click(getByRole('button', { name: /^Verify$/i }))

    await vi.waitFor(() => expect(signInMock).toHaveBeenCalledOnce())
    expect(signInMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: '1234567',
    })
    await vi.waitFor(() => expect(setUserMock).toHaveBeenCalledOnce())
    expect(setUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNo: 'user-123',
        email: 'a@b.com',
        role: ['admin'],
        exp: expect.any(Number),
      })
    )
    expect(setAccessTokenMock).toHaveBeenCalledWith('test-access-token')
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/admin/dashboard',
        replace: true,
      })
    )
  })

  it('navigates to the saved redirect target after verification', async () => {
    pendingState.signin = {
      email: 'a@b.com',
      password: '1234567',
      redirectTo: '/patient',
    }
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

    const { getByLabelText, getByRole } = await render(
      <OtpForm email='a@b.com' purpose='signin' resendCooldown={0} />
    )

    await userEvent.fill(getByLabelText(/^One-Time Password$/i), '123456')
    await userEvent.click(getByRole('button', { name: /^Verify$/i }))

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/patient',
        replace: true,
      })
    )
  })
})

describe('OtpForm (password reset)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    verifyOtpMock.mockResolvedValue({
      valid: true,
      message: 'Verification successful.',
    })
    sendOtpMock.mockResolvedValue({
      message: 'Verification code sent.',
      expiresIn: 600,
      cooldown: 60,
    })
    resetPasswordMock.mockResolvedValue({
      message: 'Password updated successfully.',
    })
  })

  it('sends the code automatically when the page loads', async () => {
    await render(<OtpForm email='a@b.com' purpose='reset' resendCooldown={0} />)

    await vi.waitFor(() =>
      expect(sendOtpMock).toHaveBeenCalledWith({
        email: 'a@b.com',
        purpose: 'reset',
      })
    )
    await vi.waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'A new code was sent to a@b.com.'
      )
    )
  })

  it('shows the new-password step after verifying the code', async () => {
    const { getByLabelText, getByRole } = await render(
      <OtpForm email='a@b.com' purpose='reset' resendCooldown={0} />
    )

    await userEvent.fill(getByLabelText(/^One-Time Password$/i), '123456')
    await userEvent.click(getByRole('button', { name: /^Verify$/i }))

    await vi.waitFor(() => expect(verifyOtpMock).toHaveBeenCalledOnce())
    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      purpose: 'reset',
      code: '123456',
    })

    await expect
      .element(getByLabelText(/^New password$/i))
      .toBeInTheDocument()
    await expect
      .element(getByLabelText(/^Confirm new password$/i))
      .toBeInTheDocument()
  })

  it('resets the password and redirects to sign-in', async () => {
    const { getByLabelText, getByRole } = await render(
      <OtpForm email='a@b.com' purpose='reset' resendCooldown={0} />
    )

    await userEvent.fill(getByLabelText(/^One-Time Password$/i), '123456')
    await userEvent.click(getByRole('button', { name: /^Verify$/i }))

    await userEvent.fill(
      await getByLabelText(/^New password$/i),
      'new-password-1'
    )
    await userEvent.fill(
      await getByLabelText(/^Confirm new password$/i),
      'new-password-1'
    )
    await userEvent.click(getByRole('button', { name: /^Update password$/i }))

    await vi.waitFor(() =>
      expect(resetPasswordMock).toHaveBeenCalledWith({
        email: 'a@b.com',
        newPassword: 'new-password-1',
      })
    )
    expect(clearPendingResetMock).toHaveBeenCalledOnce()
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/sign-in', replace: true })
    )
    await vi.waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Password updated — sign in with your new password.'
      )
    )
  })

  it('validates that the passwords match', async () => {
    const { getByLabelText, getByRole, getByText } = await render(
      <OtpForm email='a@b.com' purpose='reset' resendCooldown={0} />
    )

    await userEvent.fill(getByLabelText(/^One-Time Password$/i), '123456')
    await userEvent.click(getByRole('button', { name: /^Verify$/i }))

    await userEvent.fill(await getByLabelText(/^New password$/i), 'new-password-1')
    await userEvent.fill(
      await getByLabelText(/^Confirm new password$/i),
      'different-password'
    )
    await userEvent.click(getByRole('button', { name: /^Update password$/i }))

    await expect
      .element(getByText('Passwords do not match.'))
      .toBeInTheDocument()
    expect(resetPasswordMock).not.toHaveBeenCalled()
  })

  it('shows an error toast when the password update fails', async () => {
    resetPasswordMock.mockRejectedValue(new Error('Reset expired.'))

    const { getByLabelText, getByRole } = await render(
      <OtpForm email='a@b.com' purpose='reset' resendCooldown={0} />
    )

    await userEvent.fill(getByLabelText(/^One-Time Password$/i), '123456')
    await userEvent.click(getByRole('button', { name: /^Verify$/i }))

    await userEvent.fill(
      await getByLabelText(/^New password$/i),
      'new-password-1'
    )
    await userEvent.fill(
      await getByLabelText(/^Confirm new password$/i),
      'new-password-1'
    )
    await userEvent.click(getByRole('button', { name: /^Update password$/i }))

    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith('Reset expired.'))
    expect(navigate).not.toHaveBeenCalled()
  })
})