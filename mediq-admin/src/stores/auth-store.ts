import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

const ACCESS_TOKEN = 'thisisjustarandomstring'
// Mock-only: without a backend, the signed-in user is persisted here so the
// session (and its role) survives a reload, like a real token restore would.
const USER_COOKIE = 'mediq_user'

interface AuthUser {
  accountNo: string
  email: string
  role: string[]
  exp: number
  /** Multi-tenancy: the clinic this user is currently working in. */
  clinicId?: string
  /** The user's role within the current clinic (from clinic_members). */
  clinicRole?: 'admin' | 'front_desk' | 'doctor'
  /** Display name of the current clinic. */
  clinicName?: string
}

function safeJsonParse(value: string | undefined): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isValidAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.accountNo === 'string' &&
    typeof v.email === 'string' &&
    Array.isArray(v.role) &&
    typeof v.exp === 'number'
  )
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    /** Update just the clinic context on the existing user (no full re-login). */
    setClinic: (
      clinicId: string,
      clinicRole: 'admin' | 'front_desk' | 'doctor',
      clinicName: string
    ) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const cookieState = getCookie(ACCESS_TOKEN)
  const initToken = (safeJsonParse(cookieState) as string) || ''
  const userState = getCookie(USER_COOKIE)
  const parsedUser = safeJsonParse(userState)
  const initUser = isValidAuthUser(parsedUser) ? (parsedUser as AuthUser) : null
  if (userState && parsedUser && !isValidAuthUser(parsedUser)) {
    removeCookie(USER_COOKIE)
  }
  return {
    auth: {
      user: initUser,
      setUser: (user) =>
        set((state) => {
          if (user) {
            setCookie(USER_COOKIE, JSON.stringify(user))
          } else {
            removeCookie(USER_COOKIE)
          }
          return { ...state, auth: { ...state.auth, user } }
        }),
      setClinic: (clinicId, clinicRole, clinicName) =>
        set((state) => {
          const user = state.auth.user
            ? { ...state.auth.user, clinicId, clinicRole, clinicName }
            : null
          if (user) setCookie(USER_COOKIE, JSON.stringify(user))
          return { ...state, auth: { ...state.auth, user } }
        }),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          setCookie(ACCESS_TOKEN, JSON.stringify(accessToken))
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          removeCookie(USER_COOKIE)
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})
