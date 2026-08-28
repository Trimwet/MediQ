import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { canCheckIn, isPendingApproval } from './helpers'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Appointment {
  id: string
  patient_name: string
  patient_email: string | null
  doctor_name: string | null
  scheduled_for: string
  status: string
  clinic_id: string | null
}

interface QueuePosition {
  position: number
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'not-found' }
  | { kind: 'detail'; appointment: Appointment; queuePosition: QueuePosition | null }
  | { kind: 'success'; position: number }
  | { kind: 'already-checked-in'; position: number }

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusBadgeClasses(status: string): string {
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold'
  switch (status) {
    case 'booked':
      return `${base} bg-sky-200/40 text-sky-900 border-sky-300`
    case 'pending':
      return `${base} bg-amber-200/40 text-amber-900 border-amber-300`
    case 'arrived':
      return `${base} bg-amber-200/40 text-amber-900 border-amber-300`
    case 'in_progress':
      return `${base} bg-indigo-200/40 text-indigo-900 border-indigo-300`
    case 'completed':
      return `${base} bg-emerald-100/30 text-emerald-900 border-emerald-200`
    case 'cancelled':
    case 'rejected':
      return `${base} bg-destructive/10 text-destructive border-destructive/10`
    case 'no_show':
      return `${base} bg-neutral-300/40 border-neutral-300`
    default:
      return `${base} bg-neutral-100 text-neutral-700 border-neutral-200`
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CheckInPage() {
  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [isCheckingIn, setIsCheckingIn] = useState(false)

  /* ---- Read appointment id from ?id= search param ---- */
  const appointmentId = new URLSearchParams(window.location.search).get('id')

  /* ---- Fetch appointment + existing queue entry ---- */
  useEffect(() => {
    if (!appointmentId) {
      setState({ kind: 'error', message: 'No appointment ID provided.' })
      return
    }

    let cancelled = false

    async function load() {
      setState({ kind: 'loading' })

      // 1. Fetch appointment
      const { data: apt, error: aptErr } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId!)
        .single()

      if (cancelled) return

      if (aptErr || !apt) {
        setState({ kind: 'not-found' })
        return
      }

      // 2. Check for existing queue entry
      const { data: queueEntry } = await supabase
        .from('queue_entries')
        .select('id')
        .eq('appointment_id', apt.id)
        .order('checked_in_at', { ascending: true })

      if (cancelled) return

      const existingEntry = queueEntry?.[0]

      if (existingEntry) {
        // Count position among waiting entries
        const { count } = await supabase
          .from('queue_entries')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', apt.clinic_id)
          .eq('status', 'waiting')

        if (cancelled) return

        setState({
          kind: 'already-checked-in',
          position: count ?? 1,
        })
        return
      }

      setState({
        kind: 'detail',
        appointment: apt as Appointment,
        queuePosition: null,
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [appointmentId])

  /* ---- Check-in handler ---- */
  const handleCheckIn = useCallback(async () => {
    if (state.kind !== 'detail') return
    const apt = state.appointment
    setIsCheckingIn(true)

    try {
      // 1. Insert queue entry
      const { error: insertErr } = await supabase.from('queue_entries').insert({
        appointment_id: apt.id,
        patient_name: apt.patient_name,
        appointment_time: apt.scheduled_for,
        doctor_name: apt.doctor_name ?? '',
        clinic_id: apt.clinic_id,
        status: 'waiting',
      })

      if (insertErr) throw insertErr

      // 2. Update appointment status to arrived
      const { error: updateErr } = await supabase
        .from('appointments')
        .update({ status: 'arrived' })
        .eq('id', apt.id)

      if (updateErr) throw updateErr

      // 3. Get position in queue
      const { count } = await supabase
        .from('queue_entries')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', apt.clinic_id)
        .eq('status', 'waiting')

      setState({ kind: 'success', position: count ?? 1 })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Check-in failed. Please try again.'
      setState({ kind: 'error', message })
    } finally {
      setIsCheckingIn(false)
    }
  }, [state])

  /* ---- Render ---- */

  if (state.kind === 'loading') {
    return (
      <div className='flex min-h-screen items-center justify-center bg-background p-4'>
        <Card className='w-full max-w-md'>
          <CardContent className='flex flex-col items-center gap-3 py-10'>
            <div className='size-8 animate-spin rounded-full border-4 border-muted border-t-primary' />
            <p className='text-sm text-muted-foreground'>Loading appointment…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className='flex min-h-screen items-center justify-center bg-background p-4'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle className='text-destructive'>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground'>{state.message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state.kind === 'not-found') {
    return (
      <div className='flex min-h-screen items-center justify-center bg-background p-4'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle>Appointment Not Found</CardTitle>
            <CardDescription>
              No appointment matches the scanned QR code. Please check with
              reception.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (state.kind === 'already-checked-in') {
    return (
      <div className='flex min-h-screen items-center justify-center bg-background p-4'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle>Already Checked In</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            <p className='text-sm text-muted-foreground'>
              You have already been checked in.
            </p>
            <p className='text-lg font-semibold'>
              Queue position: #{state.position}
            </p>
            <p className='text-sm text-muted-foreground'>
              Please wait to be called by the reception desk.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state.kind === 'success') {
    return (
      <div className='flex min-h-screen items-center justify-center bg-background p-4'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle className='text-emerald-600'>Checked In!</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            <p className='text-sm text-muted-foreground'>
              You have been successfully checked in.
            </p>
            <p className='text-lg font-semibold'>
              Queue position: #{state.position}
            </p>
            <p className='text-sm text-muted-foreground'>
              Please wait to be called by the reception desk.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* kind === 'detail' */
  const apt = state.appointment
  const eligible = canCheckIn(apt)
  const awaiting = isPendingApproval(apt)

  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Check In</CardTitle>
          <CardDescription>Verify your appointment details below</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2 text-sm'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Patient</span>
              <span className='font-medium'>{apt.patient_name}</span>
            </div>
            {apt.doctor_name && (
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Doctor</span>
                <span className='font-medium'>{apt.doctor_name}</span>
              </div>
            )}
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Scheduled</span>
              <span className='font-medium'>
                {formatDateTime(apt.scheduled_for)}
              </span>
            </div>
            <div className='flex justify-between items-center'>
              <span className='text-muted-foreground'>Status</span>
              <span className={getStatusBadgeClasses(apt.status)}>
                {apt.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {eligible ? (
            <Button
              className='w-full'
              size='lg'
              onClick={handleCheckIn}
              disabled={isCheckingIn}
            >
              {isCheckingIn ? 'Checking in…' : 'Check In'}
            </Button>
          ) : awaiting ? (
            <div className='text-center space-y-1'>
              <p className='text-sm font-medium text-amber-600'>
                Awaiting Approval
              </p>
              <p className='text-xs text-muted-foreground'>
                Your appointment is pending staff approval. You will be able to
                check in once it is confirmed.
              </p>
            </div>
          ) : (
            <p className='text-center text-sm text-muted-foreground'>
              This appointment cannot be checked in (status: {apt.status}).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
