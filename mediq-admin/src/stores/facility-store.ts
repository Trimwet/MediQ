import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useAuthStore } from '@/stores/auth-store'

export const ROOM_LABEL_SUGGESTIONS = [
  'Room',
  'Office',
  'Station',
  'Booth',
  'Desk',
  'Bay',
  'Consultation room',
] as const

interface FacilityState {
  trackRooms: boolean
  roomLabel: string
  setTrackRooms: (trackRooms: boolean) => void
  setRoomLabel: (roomLabel: string) => void
}

function getClinicId(): string | null {
  try {
    return useAuthStore.getState().auth.user?.clinicId ?? null
  } catch {
    return null
  }
}

function getScopedKey(clinicId: string | null, legacyName: string): string {
  return clinicId ? `mediq_facility:${clinicId}` : legacyName
}

const clinicScopedStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined')
      return null
    try {
      const clinicId = getClinicId()
      const scopedKey = getScopedKey(clinicId, name)
      // Prefer clinic-scoped value if present
      const scopedValue = localStorage.getItem(scopedKey)
      if (scopedValue !== null) return scopedValue
      // Fallback to legacy global key
      if (scopedKey !== name) {
        const legacyValue = localStorage.getItem(name)
        if (legacyValue !== null) {
          // Migrate legacy -> scoped for future reads (best-effort)
          try {
            localStorage.setItem(scopedKey, legacyValue)
          } catch {
            // ignore quota / private mode
          }
          return legacyValue
        }
      }
      return null
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined')
      return
    try {
      // Always keep legacy key for backwards compatibility
      localStorage.setItem(name, value)
      const clinicId = getClinicId()
      const scopedKey = getScopedKey(clinicId, name)
      if (scopedKey !== name) {
        localStorage.setItem(scopedKey, value)
      }
    } catch {
      // ignore quota errors
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined')
      return
    try {
      localStorage.removeItem(name)
      const clinicId = getClinicId()
      const scopedKey = getScopedKey(clinicId, name)
      if (scopedKey !== name) {
        localStorage.removeItem(scopedKey)
      }
    } catch {
      // ignore
    }
  },
}

export const useFacilityStore = create<FacilityState>()(
  persist(
    (set) => ({
      trackRooms: true,
      roomLabel: 'Room',
      setTrackRooms: (trackRooms) => set({ trackRooms }),
      setRoomLabel: (roomLabel) =>
        set({ roomLabel: roomLabel.trim() || 'Room' }),
    }),
    {
      name: 'mediq_facility',
      storage: createJSONStorage(() => clinicScopedStorage),
    }
  )
) /**
 * "Room 2" for a bare identifier (e.g. '2'), or "Room not set" when missing.
 * Data stores bare identifiers — the facility label is applied here at render
 * time so clinics can rename their rooms without touching the data.
 */
export function formatRoom(number: string | undefined, label = 'Room'): string {
  return number ? `${label} ${number}` : `${label} not set`
}

/**
 * Label for the "in room" stage of the serving journey. Clinics that do not
 * track rooms fall back to a neutral "In consultation".
 */
export function inStageLabel(trackRooms: boolean, label = 'Room'): string {
  return trackRooms ? `In ${label.toLowerCase()}` : 'In consultation'
}
