/**
 * Mock account registry — simulates Supabase Auth for sign-up and sign-in.
 *
 * In production the flow is:
 *   1. A visitor books an appointment without an account (the booking is
 *      just a pending request for the clinic to approve).
 *   2. They create their account afterwards with `auth.signUp({ email,
 *      password })` — the email they already provided at booking — and any
 *      further onboarding details are collected at that point.
 *   3. They sign in with `auth.signInWithPassword`.
 *
 * Here the same contract lives in localStorage so the flow works end to
 * end with no backend: sign-up writes the account, sign-in reads it, and
 * `changePassword` swaps the password.
 */

export interface MockAccount {
  name: string
  email: string
  role: string[]
  password: string
  /** Set when the account was provisioned with a temporary password that the
   * user must replace on their first sign-in. Cleared by `changePassword`. */
  mustChangePassword?: boolean
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

export function getAccount(email: string): MockAccount | undefined {
  return readAccounts()[email.toLowerCase()]
}

/**
 * Create a patient account with the password the user chose at sign-up.
 * The name is optional — it defaults from the email's local part (the
 * booking flow already collected the patient's full name separately).
 */
export function createAccount(input: {
  name?: string
  email: string
  password: string
}): { account: MockAccount } {
  const email = input.email.toLowerCase()
  const accounts = readAccounts()
  const account: MockAccount = {
    name: input.name || email.split('@')[0],
    email,
    role: ['patient'],
    password: input.password,
    createdAt: new Date().toISOString(),
  }
  accounts[email] = account
  writeAccounts(accounts)
  return { account }
}

/** Generate a human-friendly one-time password (no ambiguous characters). */
function generateTemporaryPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

/**
 * Provision a staff account (admin invite). Generates a one-time temporary
 * password and flags the account so first sign-in forces a password change.
 * Returns the temporary password — in production this would be emailed to
 * the invitee; in the mock the admin shares it with them directly.
 */
export function inviteStaffAccount(input: {
  name: string
  email: string
  role: string
}): { account: MockAccount; temporaryPassword: string } {
  const email = input.email.toLowerCase()
  const accounts = readAccounts()
  const temporaryPassword = generateTemporaryPassword()
  const account: MockAccount = {
    name: input.name,
    email,
    role: [input.role],
    password: temporaryPassword,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  }
  accounts[email] = account
  writeAccounts(accounts)
  return { account, temporaryPassword }
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

/** Replace the password and clear the first-login change requirement. */
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
