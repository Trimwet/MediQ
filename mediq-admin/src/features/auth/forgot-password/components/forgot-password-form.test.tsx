import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { userEvent, type Locator } from 'vitest/browser'
import { ForgotPasswordForm } from './forgot-password-form'

const navigate = vi.hoisted(() => vi.fn())
const savePendingResetMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('@/lib/pending-auth', () => ({
  savePendingReset: (...args: unknown[]) => savePendingResetMock(...args),
}))

describe('ForgotPasswordForm', () => {
  let screen: RenderResult
  let emailInput: Locator
  let continueButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()

    screen = await render(<ForgotPasswordForm />)
    emailInput = screen.getByRole('textbox', { name: /^Email$/i })
    continueButton = screen.getByRole('button', { name: /^Continue$/i })
  })

  it('renders email field and continue button', async () => {
    await expect.element(emailInput).toBeInTheDocument()
    await expect.element(continueButton).toBeInTheDocument()
  })

  it('shows validation when submitting empty form', async () => {
    await userEvent.click(continueButton)
    await expect
      .element(screen.getByText(/^Please enter your email\.$/i))
      .toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('navigates straight to the OTP page without calling any function', async () => {
    await userEvent.fill(emailInput, 'a@b.com')
    await userEvent.click(continueButton)

    expect(savePendingResetMock).toHaveBeenCalledWith({ email: 'a@b.com' })
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/otp',
        search: { email: 'a@b.com', purpose: 'reset' },
      })
    )
  })
})