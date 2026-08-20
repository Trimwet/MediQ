/**
 * useRealtimeSync
 *
 * Opens a single Supabase Realtime WebSocket channel that listens for
 * Postgres row-level changes across every core table. When a change arrives,
 * the matching React Query cache keys are invalidated so all subscribed
 * components re-fetch transparently - no manual refresh needed.
 *
 * The channel is opened once on mount and torn down on unmount. Because this
 * hook lives in the root component it is active for the entire session.
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type Table =
  | 'appointments'
  | 'queue_entries'
  | 'patients'
  | 'doctors'
  | 'staff'
  | 'rooms'
  | 'notifications'

/** Map from table name -> React Query cache keys to bust. */
const TABLE_KEYS: Record<Table, string[]> = {
  // Notifications are NOT included here: approve/reject mutations already
  // call queryClient.invalidateQueries(['notifications']) in their onSuccess
  // callbacks, so including it here would cause a double refetch every time
  // an appointment row changes.
  appointments: ['appointments'],
  // queue_entries drives both the queue view and room occupancy display.
  queue_entries: ['queue', 'rooms'],
  patients: ['patients'],
  doctors: ['doctors'],
  staff: ['staff'],
  rooms: ['rooms'],
  notifications: ['notifications'],
}

const TABLES = Object.keys(TABLE_KEYS) as Table[]

export function useRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase.channel('mediq-realtime-sync')

    TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          const keys = TABLE_KEYS[table]
          keys.forEach((key) =>
            queryClient.invalidateQueries({ queryKey: [key] })
          )
        }
      )
    })

    channel.subscribe((status) => {
      if (import.meta.env.DEV) {
        console.debug('[MediQ Realtime]', status)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}