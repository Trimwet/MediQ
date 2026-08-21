import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { SignUpForm } from './sign-up-form'

const FORM_MESSAGES = {
  emailEmpty: 'Please enter your email.',
  passwordEmpty: 'Please enter your password.',
  confirmPasswordEmpty: 'Please confirm your password.',
  passwordMismatch: "Passwords don't match.",
} as const

const sendOtpMock = vi.hoisted(() => vi.fn())
const savePendingSignupMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@/lib/otp', () => ({
  sendOtp: (...args: unknown[]) => sendOtpMock(...args),
}))

vi.mock('@/lib/pending-auth', () => ({
  savePendingSignup: (...args: unknown[]) => savePendingSignupMock(...args),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('sonner', () => ({ toast: { error: toastError } }))

describe('SignUpForm', () => {
  let screen: RenderResult
  let emailInput: Locator
  let passwordInput: Locator
  let confirmPasswordInput: Locator
  let submitButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()
    sendOtpMock.mockResolvedValue({
      message: 'Verification code sent.',
      expiresIn: 600,
      cooldown: 60,
    })

    screen = await render(<SignUpForm />)
    emailInput = screen.getByRole('textbox', { name: /^Email$/i })
    passwordInput = screen.getByLabelText(/^Password$/i)
    confirmPasswordInput = screen.getByLabelText(/^Confirm Password$/i)
    submitButton = screen.getByRole('button', { name: /^Create Account$/i })
  })

  it('renders fields and submit button', async () => {
    await expect.element(emailInput).toBeInTheDocument()
    await expect.element(passwordInput).toBeInTheDocument()
    await expect.element(confirmPasswordInput).toBeInTheDocument()
    await expect.element(submitButton).toBeInTheDocument()
  })

  it('shows validation messages when submitting empty form', async () => {
    await userEvent.click(submitButton)

    await expect
      .element(screen.getByText(FORM_MESSAGES.emailEmpty))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText(FORM_MESSAGES.passwordEmpty))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText(FORM_MESSAGES.confirmPasswordEmpty))
      .toBeInTheDocument()
  })

  it('shows a mismatch error when passwords do not match', async () => {
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, '1234567')
    await userEvent.fill(confirmPasswordInput, '7654321')

    await userEvent.click(submitButton)
    await expect
      .element(screen.getByText(FORM_MESSAGES.passwordMismatch))
      .toBeInTheDocument()
  })

  it('sends an OTP and navigates to the verification page on submit', async () => {
    await userEvent.fill(screen.getByRole('textbox', { name: /^Full name$/i }), 'Aisha Bello')
    await userEvent.fill(screen.getByRole('textbox', { name: /^Phone$/i }), '+2348000000000')
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, '1234567')
    await userEvent.fill(confirmPasswordInput, '1234567')

    await userEvent.click(submitButton)

    await vi.waitFor(() =>
      expect(sendOtpMock).toHaveBeenCalledWith({
        email: 'a@b.com',
        purpose: 'signup',
      })
    )
    expect(savePendingSignupMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: '1234567',
      name: 'Aisha Bello',
      phone: '+2348000000000',
      source: 'sign-up',
    })
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/otp',
        search: { email: 'a@b.com', purpose: 'signup' },
      })
    )
  })

  it('shows an error toast when the OTP cannot be sent', async () => {
    sendOtpMock.mockRejectedValue(new Error('Could not send the email.'))

    await userEvent.fill(screen.getByRole('textbox', { name: /^Full name$/i }), 'Aisha Bello')
    await userEvent.fill(screen.getByRole('textbox', { name: /^Phone$/i }), '+2348000000000')
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, '1234567')
    await userEvent.fill(confirmPasswordInput, '1234567')

    await userEvent.click(submitButton)

    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Could not send the email.')
    )
    expect(savePendingSignupMock).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})