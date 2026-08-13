/**
 * Mock account registry — simulates Supabase Auth for the self-service
 * booking flow.
 *
 * In production the sequence is:
 *   1. The booking edge function calls `auth.admin.createUser({ email,
 *      password: temporary, email_confirm: true })` with a one-time
 *      temporary password.
 *   2. Resend emails the credentials.
 *   3. The patient signs in with `auth.signInWithPassword`, and a
 *      `profiles.must_change_password` flag forces the first-login
 *      password change.
 *
 * Here the same contract lives in localStorage so the flow works end to
 * end with no backend: booking creates an account, sign-in reads it, and
 * `changePassword` clears the forced-change flag.
 */

export interface MockAccount {
  name: string
  email: string
  role: string[]
  /** The current password — the temporary one until changed. */
  password: string
  mustChangePassword: boolean
  createdAt: string
}

const STORAGE_KEY = 'mediq_mock_accounts'

function readAccounts(): Record<string, MockAccount> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, MockAccount>) : {}
  } catch {
    return {}
  }
}

function writeAccounts(accounts: Record<string, MockAccount>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}

function generateTemporaryPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let value = ''
  for (let i = 0; i < 10; i++) {
    value += chars[Math.floor(Math.random() * chars.length)]
  }
  return `MediQ-${value}`
}

export function getAccount(email: string): MockAccount | undefined {
  return readAccounts()[email.toLowerCase()]
}

/**
 * Create a patient account with a one-time temporary password. Returns the
 * password so the mock flow can surface it (production emails it instead).
 */
export function createAccount(input: {
  name: string
  email: string
}): { account: MockAccount; password: string } {
  const email = input.email.toLowerCase()
  const accounts = readAccounts()
  const password = generateTemporaryPassword()
  const account: MockAccount = {
    name: input.name,
    email,
    role: ['patient'],
    password,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  }
  accounts[email] = account
  writeAccounts(accounts)
  return { account, password }
}

/**
 * Verify credentials against the registry. Returns the account on success,
 * `null` when the account exists but the password is wrong, and `undefined`
 * when no account exists for that email (the caller falls back to the
 * dev-only role picker).
 */
export function verifyAccount(
  email: string,
  password: string
): MockAccount | null | undefined {
  const account = getAccount(email)
  if (!account) return undefined
  return account.password === password ? account : null
}

/** Replace the password and clear the forced-change flag. */
export function changePassword(email: string, newPassword: string) {
  const accounts = readAccounts()
  const account = accounts[email.toLowerCase()]
  if (!account) return
  accounts[email.toLowerCase()] = {
    ...account,
    password: newPassword,
    mustChangePassword: false,
  }
  writeAccounts(accounts)
}

/** Dev/testing helper: wipe all mock accounts. */
export function clearAccounts() {
  localStorage.removeItem(STORAGE_KEY)
}
