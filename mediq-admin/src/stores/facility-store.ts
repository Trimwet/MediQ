import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

export const useFacilityStore = create<FacilityState>()(
  persist(
    (set) => ({
      trackRooms: true,
      roomLabel: 'Room',
      setTrackRooms: (trackRooms) => set({ trackRooms }),
      setRoomLabel: (roomLabel) =>
        set({ roomLabel: roomLabel.trim() || 'Room' }),
    }),
    { name: 'mediq_facility' }
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
