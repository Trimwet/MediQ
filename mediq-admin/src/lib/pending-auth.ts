/**
 * Pending-auth payloads for the email OTP (2FA) step.
 *
 * Sign-in and sign-up are held in two steps: the user submits their details
 * (credentials are validated / an account is created) only AFTER the email
 * code is verified. Between the two steps the pending payload lives in
 * sessionStorage so it survives the navigation to the OTP page but is
 * cleared on tab close.
 */

export interface PendingSignup {
  email: string
  password: string
  name?: string
  phone?: string
  /** Where the sign-up originated — decides where to send the user after verification. */
  source: 'sign-up' | 'booking'
}

export interface PendingSignin {
  email: string
  password: string
  redirectTo?: string
}

export interface PendingReset {
  email: string
}

const SIGNUP_KEY = 'mediq_pending_signup'
const SIGNIN_KEY = 'mediq_pending_signin'
const RESET_KEY = 'mediq_pending_reset'

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sessionStorage unavailable (e.g. private mode) — the OTP page will
    // prompt the user to start the flow again.
  }
}

function remove(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function savePendingSignup(input: PendingSignup) {
  write(SIGNUP_KEY, input)
}

export function getPendingSignup(): PendingSignup | null {
  return read<PendingSignup>(SIGNUP_KEY)
}

export function clearPendingSignup() {
  remove(SIGNUP_KEY)
}

export function savePendingSignin(input: PendingSignin) {
  write(SIGNIN_KEY, input)
}

export function getPendingSignin(): PendingSignin | null {
  return read<PendingSignin>(SIGNIN_KEY)
}

export function clearPendingSignin() {
  remove(SIGNIN_KEY)
}

export function savePendingReset(input: PendingReset) {
  write(RESET_KEY, input)
}

export function clearPendingReset() {
  remove(RESET_KEY)
}