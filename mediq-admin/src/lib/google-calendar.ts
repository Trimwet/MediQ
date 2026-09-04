/**
 * Google Calendar integration — uses the modern Google Identity Services (GIS)
 * token client for OAuth and gapi.client for Calendar API calls.
 *
 * Auth flow:
 *  1. gapi.client is loaded for Calendar API calls
 *  2. google.accounts.oauth2.initTokenClient() handles the OAuth popup
 *  3. The access token is saved to sessionStorage so the popup only appears
 *     once per browser session (survives page reloads, cleared on tab close)
 */
import type { Appointment } from '@/features/appointments/schema'

const DISCOVERY_DOC =
  'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

const SYNCABLE_STATUSES: Appointment['status'][] = [
  'booked',
  'arrived',
  'in_progress',
]

// ── Helpers to access window globals safely ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gapi = () => (window as any).gapi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const google = () => (window as any).google

// ── GAPI client bootstrap ─────────────────────────────────────────────────────

let _gapiReady = false

async function ensureGapiClient(): Promise<void> {
  if (_gapiReady) return

  await new Promise<void>((resolve, reject) => {
    const g = gapi()
    if (!g) {
      reject(new Error('Google API script not loaded. Check index.html.'))
      return
    }
    g.load('client', () => resolve())
  })

  await gapi().client.init({ discoveryDocs: [DISCOVERY_DOC] })
  _gapiReady = true
}

// ── Token persistence (sessionStorage) ───────────────────────────────────────
// sessionStorage survives page reloads within the same tab but is cleared
// when the tab or browser is closed — safe for short-lived OAuth tokens.

const TOKEN_KEY = 'mediq_gcal_token'
const EXPIRY_KEY = 'mediq_gcal_token_expiry'

function loadSavedToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) ?? 0)
    if (token && Date.now() < expiry) return token
  } catch {}
  return null
}

function saveToken(token: string, expiresInSeconds = 3599): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
    sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000))
  } catch {}
}

function clearSavedToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(EXPIRY_KEY)
  } catch {}
}

// ── GIS token client ──────────────────────────────────────────────────────────

let _tokenClient: unknown = null
let _accessToken: string | null = null

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  if (!id || id.includes('paste-it-here') || id.includes('abcdefgh')) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID is not set correctly. Check your .env file.'
    )
  }
  return id
}

/**
 * Returns a valid OAuth access token.
 * - First call in a session: shows the Google popup once, then caches the token.
 * - Subsequent calls (same page or after reload): returns the cached token
 *   immediately with no popup.
 */
async function requestAccessToken(): Promise<string> {
  // 1. In-memory cache (fastest — same JS session)
  if (_accessToken) return _accessToken

  // 2. sessionStorage cache (survives page reloads within the same tab)
  const saved = loadSavedToken()
  if (saved) {
    _accessToken = saved
    await ensureGapiClient()
    gapi().client.setToken({ access_token: saved })
    return saved
  }

  // 3. No token found — show the Google popup once
  await ensureGapiClient()

  return new Promise<string>((resolve, reject) => {
    if (!_tokenClient) {
      _tokenClient = google().accounts.oauth2.initTokenClient({
        client_id: getClientId(),
        scope: SCOPE,
        callback: (response: { access_token?: string; expires_in?: number; error?: string }) => {
          if (response.error) {
            reject(new Error(`Google auth error: ${response.error}`))
            return
          }
          if (!response.access_token) {
            reject(new Error('No access token received from Google.'))
            return
          }
          _accessToken = response.access_token
          gapi().client.setToken({ access_token: response.access_token })
          // Persist so the next sync/clear in this tab skips the popup
          saveToken(response.access_token, response.expires_in ?? 3599)
          resolve(response.access_token)
        },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(_tokenClient as any).requestAccessToken({ prompt: 'consent' })
  })
}

export function signOutFromGoogle(): void {
  if (_accessToken) {
    google()?.accounts.oauth2.revoke(_accessToken, () => {})
    _accessToken = null
    _tokenClient = null
    gapi()?.client.setToken(null)
    clearSavedToken()
  }
}

// ── Event helpers ─────────────────────────────────────────────────────────────

function appointmentToEvent(appt: Appointment) {
  const start = appt.scheduledFor
  const endDate = new Date(new Date(start).getTime() + 30 * 60 * 1000)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  return {
    summary: `${appt.patientName} — Dr. ${appt.doctorName}`,
    description: [
      appt.reason ? `Reason: ${appt.reason}` : '',
      `Status: ${appt.status}`,
      `MediQ ID: ${appt.id}`,
    ]
      .filter(Boolean)
      .join('\n'),
    start: { dateTime: start, timeZone: tz },
    end: { dateTime: endDate.toISOString(), timeZone: tz },
    extendedProperties: {
      private: { mediqId: appt.id },
    },
  }
}

async function findExistingEvent(apptId: string): Promise<string | null> {
  const res = await gapi().client.calendar.events.list({
    calendarId: 'primary',
    privateExtendedProperty: `mediqId=${apptId}`,
    maxResults: 1,
    singleEvents: true,
  })
  const items: { id: string }[] = res.result.items ?? []
  return items.length > 0 ? items[0].id : null
}

// ── Public clear API ──────────────────────────────────────────────────────────

export interface ClearResult {
  deleted: number
  errors: string[]
}

/**
 * Finds all calendar events that were synced by MediQ (identified by the
 * private `mediqId` extended property) and deletes them from the primary
 * calendar. Requires the same OAuth scope as sync.
 */
export async function clearAppointmentsFromGoogleCalendar(): Promise<ClearResult> {
  const result: ClearResult = { deleted: 0, errors: [] }

  await requestAccessToken()

  // Fetch events over a wide window and filter client-side for ones that have
  // our private `mediqId` extended property. The Google Calendar API does NOT
  // support wildcard privateExtendedProperty queries — it requires an exact
  // key=value match — so we must identify MediQ events locally.
  const now = new Date()
  const timeMin = new Date(now)
  timeMin.setFullYear(timeMin.getFullYear() - 2)
  const timeMax = new Date(now)
  timeMax.setFullYear(timeMax.getFullYear() + 2)

  let pageToken: string | undefined
  const eventIds: string[] = []

  do {
    const res = await gapi().client.calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 250,
      singleEvents: true,
      ...(pageToken ? { pageToken } : {}),
    })

    const items: {
      id: string
      summary?: string
      extendedProperties?: { private?: Record<string, string> }
    }[] = res.result.items ?? []

    for (const item of items) {
      const hasMediqId = !!item.extendedProperties?.private?.mediqId
      // Fallback: match events whose summary follows the MediQ pattern
      // "PatientName — Dr. DoctorName" for events synced before extended
      // properties were reliably stored.
      const hasMediqSummary = /\s—\sDr\.\s/.test(item.summary ?? '')

      if (hasMediqId || hasMediqSummary) {
        eventIds.push(item.id)
      }
    }

    pageToken = res.result.nextPageToken
  } while (pageToken)

  // Delete each MediQ-owned event
  for (const eventId of eventIds) {
    try {
      await gapi().client.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      })
      result.deleted++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`[event ${eventId}] ${msg}`)
    }
  }

  return result
}

// ── Public sync API ───────────────────────────────────────────────────────────

export interface SyncResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export async function syncAppointmentsToGoogleCalendar(
  appointments: Appointment[]
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  await requestAccessToken()

  const syncable = appointments.filter((a) =>
    SYNCABLE_STATUSES.includes(a.status)
  )
  result.skipped = appointments.length - syncable.length

  for (const appt of syncable) {
    try {
      const eventBody = appointmentToEvent(appt)
      const existingId = await findExistingEvent(appt.id)

      if (existingId) {
        await gapi().client.calendar.events.update({
          calendarId: 'primary',
          eventId: existingId,
          resource: eventBody,
        })
        result.updated++
      } else {
        await gapi().client.calendar.events.insert({
          calendarId: 'primary',
          resource: eventBody,
        })
        result.created++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`[${appt.patientName}] ${msg}`)
    }
  }

  return result
}
