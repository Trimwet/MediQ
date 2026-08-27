import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { SignUpForm } from './sign-up-form'

const signUpMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const toastPromise = vi.hoisted(() =>
  vi.fn((p: Promise<unknown>, opts: { success?: () => unknown }) => {
    p.then(() => opts.success?.())
  })
)

vi.mock('@/data', () => ({
  authRepository: { signUp: (...args: unknown[]) => signUpMock(...args) },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('sonner', () => ({
  toast: { promise: toastPromise },
}))

describe('SignUpForm', () => {
  let screen: RenderResult
  let nameInput: Locator
  let phoneInput: Locator
  let emailInput: Locator
  let passwordInput: Locator
  let confirmPasswordInput: Locator
  let submitButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()
    signUpMock.mockResolvedValue({ email: 'a@b.com', role: ['patient'] })

    screen = await render(<SignUpForm />)
    nameInput = screen.getByRole('textbox', { name: /^Full name$/i })
    phoneInput = screen.getByRole('textbox', { name: /^Phone$/i })
    emailInput = screen.getByRole('textbox', { name: /^Email$/i })
    passwordInput = screen.getByLabelText(/^Password$/i)
    confirmPasswordInput = screen.getByLabelText(/^Confirm Password$/i)
    submitButton = screen.getByRole('button', { name: /^Create Account$/i })
  })

  it('renders fields and submit button', async () => {
    await expect.element(nameInput).toBeInTheDocument()
    await expect.element(phoneInput).toBeInTheDocument()
    await expect.element(emailInput).toBeInTheDocument()
    await expect.element(passwordInput).toBeInTheDocument()
    await expect.element(confirmPasswordInput).toBeInTheDocument()
    await expect.element(submitButton).toBeInTheDocument()
  })

  it('shows validation messages when submitting empty form', async () => {
    await userEvent.click(submitButton)

    await expect
      .element(screen.getByText(/^Please enter your full name/i))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText(/^Please enter your email\.$/i))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText(/^Please enter your password\.$/i))
      .toBeInTheDocument()
  })

  it('shows a mismatch error when passwords do not match', async () => {
    await userEvent.fill(nameInput, 'Isaac')
    await userEvent.fill(phoneInput, '+2348000000000')
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, '1234567')
    await userEvent.fill(confirmPasswordInput, '7654321')

    await userEvent.click(submitButton)
    await expect
      .element(screen.getByText(/Passwords don't match/i))
      .toBeInTheDocument()
  })

  it('creates the account and navigates to sign-in on success', async () => {
    await userEvent.fill(nameInput, 'Isaac Yakubu')
    await userEvent.fill(phoneInput, '+2348000000000')
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, '1234567')
    await userEvent.fill(confirmPasswordInput, '1234567')

    await userEvent.click(submitButton)

    await vi.waitFor(() =>
      expect(signUpMock).toHaveBeenCalledWith({
        name: 'Isaac Yakubu',
        email: 'a@b.com',
        password: '1234567',
        phone: '+2348000000000',
      })
    )
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/sign-in' })
    )
  })

  it('disables submit while submitting and re-enables after', async () => {
    let resolve!: (value: unknown) => void
    signUpMock.mockReturnValue(new Promise((r) => (resolve = r)))

    await userEvent.fill(nameInput, 'Isaac')
    await userEvent.fill(phoneInput, '+2348000000000')
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.fill(passwordInput, '1234567')
    await userEvent.fill(confirmPasswordInput, '1234567')

    await userEvent.click(submitButton)
    await expect.element(submitButton).toBeDisabled()

resolve({ email: 'a@b.com', role: ['patient'] })
    await expect.element(submitButton).toBeEnabled()
  })
})