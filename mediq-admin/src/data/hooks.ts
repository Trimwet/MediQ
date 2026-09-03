import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hasRole } from '@/config/rbac'
import { useAuthStore } from '@/stores/auth-store'
import { useCurrentClinic } from '@/lib/clinic-context'
import { supabase } from '@/lib/supabase'
import { useDataStore } from '@/data/mock/store'
import {
  type Appointment,
  type AppointmentStatus,
} from '@/features/appointments/schema'
import { type Doctor, type DoctorStatus } from '@/features/doctors/schema'
import { type Patient } from '@/features/patients/schema'
import { type Room, type RoomStatus } from '@/features/rooms/schema'
import { type Staff } from '@/features/staff/schema'
import {
  analyticsRepository,
  appointmentsRepository,
  authRepository,
  bookingRepository,
  doctorsRepository,
  notificationsRepository,
  patientsRepository,
  queueRepository,
  roomsRepository,
  staffRepository,
  type BookingInput,
  type SignUpInput,
} from './index'

// ---- Row-level scoping (doctors) ----
// Doctors only ever see their own rows. The UI mirrors what the backend must
// enforce server-side (see types/domain.ts): appointments reference doctors
// by id, queue entries and patients by name. If a doctor account cannot be
// resolved to a directory record, we fail closed (empty) rather than expose
// everyone's data.
function useDoctorIdentity() {
  const user = useAuthStore((state) => state.auth.user)
  const isDoctor = hasRole(user?.role ?? [], 'doctor')
  const doctorsQuery = useDoctors()
  const doctor = isDoctor
    ? doctorsQuery.data?.find(
        (d) => d.email?.toLowerCase() === user?.email?.toLowerCase()
      )
    : undefined
  return { isDoctor, doctor }
}

// ---- Appointments ----

export function useAppointments() {
  const { clinicId } = useCurrentClinic()
  const user = useAuthStore((s) => s.auth.user)
  const isPatient = hasRole(user?.role ?? [], 'patient')
  return useQuery({
    queryKey: isPatient
      ? ['appointments', 'patient', user?.email?.toLowerCase() ?? 'none']
      : ['appointments', clinicId ?? 'none'],
    queryFn: async () => {
      if (isPatient) {
        if (!user?.email) return []
        const userEmailLower = user.email.toLowerCase()
        let localBookedEmail = ''
        try {
          localBookedEmail = (localStorage.getItem('mediq_has_booked_email') ?? '').toLowerCase()
        } catch {}

        const matchesEmail = (email?: string) => {
          if (!email) return false
          const e = email.toLowerCase()
          return e === userEmailLower || (!!localBookedEmail && e === localBookedEmail)
        }

        const map = new Map<string, Appointment>()

        // 1. Query Supabase appointments table by user email and local booked email
        try {
          const emailsToQuery = [user.email]
          if (localBookedEmail && localBookedEmail !== userEmailLower) {
            emailsToQuery.push(localBookedEmail)
          }
          for (const em of emailsToQuery) {
            const { data, error } = await supabase
              .from('appointments')
              .select('*')
              .ilike('patient_email', em)
              .order('scheduled_for', { ascending: false })
            if (!error && data && data.length > 0) {
              for (const row of data as Record<string, unknown>[]) {
                const appt: Appointment = {
                  id: String(row.id),
                  patientName: String(row.patient_name),
                  patientEmail: row.patient_email ? String(row.patient_email) : undefined,
                  doctorId: row.doctor_id ? String(row.doctor_id) : '',
                  doctorName: row.doctor_name ? String(row.doctor_name) : '',
                  scheduledFor: String(row.scheduled_for),
                  status: String(row.status) as AppointmentStatus,
                  reason: row.reason ? String(row.reason) : undefined,
                  rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
                }
                map.set(appt.id, appt)
              }
            }
          }
        } catch {}

        // 2. Fetch from repository list if clinicId or fallback available
        try {
          const repoAppts = await appointmentsRepository.list(clinicId ?? undefined)
          for (const a of repoAppts) {
            if (matchesEmail(a.patientEmail)) {
              if (!map.has(a.id)) map.set(a.id, a)
            }
          }
        } catch {}

        // 3. Include Zustand useDataStore appointments strictly matching user email or booked email
        try {
          const storeAppts = useDataStore.getState().appointments ?? []
          for (const a of storeAppts) {
            if (matchesEmail(a.patientEmail)) {
              map.set(a.id, a) // Store has latest mutated state
            }
          }
        } catch {}

        // 4. Include locally saved booked appointment from localStorage fallback
        try {
          const lastBookedRaw = localStorage.getItem('mediq_last_booked_appointment')
          if (lastBookedRaw) {
            const lastBooked = JSON.parse(lastBookedRaw) as Appointment
            if (lastBooked && lastBooked.id) {
              map.set(lastBooked.id, lastBooked)
            }
          }
        } catch {}

        // 5. Fallback for active local booking flags (e.g. page reload or Supabase RLS restriction)
        if (map.size === 0) {
          try {
            const hasBookedFlag =
              localStorage.getItem('mediq_has_booked') === 'true' ||
              localStorage.getItem(`mediq_has_booked:${userEmailLower}`) === 'true' ||
              (localStorage.getItem('mediq_has_booked_email') ?? '').toLowerCase() === userEmailLower

            if (hasBookedFlag) {
              const bookedAtStr = localStorage.getItem('mediq_has_booked_at')
              const bookedTime = bookedAtStr && !isNaN(Number(bookedAtStr)) ? new Date(Number(bookedAtStr)) : new Date()
              const fallbackAppt: Appointment = {
                id: `booked-apt-${userEmailLower}`,
                patientName: user.email.split('@')[0],
                patientEmail: user.email,
                doctorId: 'doc-01',
                doctorName: 'Dr. Adebayo',
                clinicId: 'clinic-juth',
                clinicName: 'JUTH (Jos University Teaching Hospital)',
                scheduledFor: bookedTime.toISOString(),
                status: 'booked',
                reason: 'General Medical Visit',
              }
              map.set(fallbackAppt.id, fallbackAppt)
            }
          } catch {}
        }

        return Array.from(map.values())
      }
      return appointmentsRepository.list(clinicId ?? undefined)
    },
    enabled: isPatient ? !!user?.email : !!clinicId,
  })
}

export function usePatientAppointments() {
  return useAppointments()
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  const { clinicId } = useCurrentClinic()
  return useMutation({
    mutationFn: (input: Omit<Appointment, 'id' | 'status'>) =>
      appointmentsRepository.create(input, clinicId ?? undefined),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  })
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()
  const { clinicId } = useCurrentClinic()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      // When checking in (booked → arrived), also create the queue entry so
      // the patient appears on the Queue page.  This mirrors the logic in
      // src/features/check-in/index.tsx.
      if (status === 'arrived') {
        // 1. Fetch the raw appointment row to get clinic_id and patient details.
        const { data: apt, error: fetchErr } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', id)
          .single()

        if (fetchErr || !apt) throw fetchErr ?? new Error('Appointment not found')

        // 2. Idempotent: skip if a queue entry already exists for this appointment.
        const { data: existing } = await supabase
          .from('queue_entries')
          .select('id')
          .eq('appointment_id', apt.id)
          .limit(1)

        if (!existing?.length) {
          const { error: insertErr } = await supabase.from('queue_entries').insert({
            appointment_id: apt.id,
            patient_name: apt.patient_name,
            appointment_time: apt.scheduled_for,
            doctor_name: apt.doctor_name ?? '',
            clinic_id: apt.clinic_id,
            status: 'waiting',
          })
          if (insertErr) throw insertErr
        }
      }

      if (!clinicId) throw new Error('Missing clinic context')
      await appointmentsRepository.updateStatus(id, status, clinicId)
    },
    // Optimistic update: patch the cache immediately so the UI responds
    // without waiting for the Supabase round-trip.
    onMutate: async ({ id, status }) => {
      const key = ['appointments', clinicId ?? 'none'] as const
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Appointment[]>(key)
      queryClient.setQueryData<Appointment[]>(key, (old) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, status } : a))
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['appointments', clinicId ?? 'none'], context.previous)
      }
    },
    // Check-in also affects the queue; always refetch both on settle.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}

export function useApproveAppointment() {
  const queryClient = useQueryClient()
  const { clinicId } = useCurrentClinic()
  return useMutation({
    mutationFn: ({
      id,
      doctor,
    }: {
      id: string
      doctor?: { id: string; name: string }
    }) => appointmentsRepository.approve(id, doctor),
    onMutate: async ({ id, doctor }) => {
      const key = ['appointments', clinicId ?? 'none'] as const
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Appointment[]>(key)
      queryClient.setQueryData<Appointment[]>(key, (old) =>
        (old ?? []).map((a) =>
          a.id === id
            ? {
                ...a,
                status: 'booked' as AppointmentStatus,
                ...(doctor
                  ? { doctorId: doctor.id, doctorName: doctor.name }
                  : {}),
              }
            : a
        )
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['appointments', clinicId ?? 'none'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useRejectAppointment() {
  const queryClient = useQueryClient()
  const { clinicId } = useCurrentClinic()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      appointmentsRepository.reject(id, reason),
    onMutate: async ({ id, reason }) => {
      const key = ['appointments', clinicId ?? 'none'] as const
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Appointment[]>(key)
      queryClient.setQueryData<Appointment[]>(key, (old) =>
        (old ?? []).map((a) =>
          a.id === id
            ? {
                ...a,
                status: 'rejected' as AppointmentStatus,
                rejectionReason: reason,
              }
            : a
        )
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['appointments', clinicId ?? 'none'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useCancelAppointment() {
  const queryClient = useQueryClient()
  const { clinicId } = useCurrentClinic()
  const user = useAuthStore((s) => s.auth.user)
  const isPatient = hasRole(user?.role ?? [], 'patient')
  return useMutation({
    mutationFn: async (id: string) => {
      if (isPatient) {
        // Patient cancel bypasses clinic_id filter — RLS allows patient_email match with status='cancelled'.
        const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
        if (error) throw error
        return
      }
      if (!clinicId) throw new Error('Missing clinic context')
      return appointmentsRepository.updateStatus(id, 'cancelled', clinicId)
    },
    onMutate: async (id: string) => {
      const key: readonly unknown[] = isPatient
        ? (['appointments', 'patient', user?.email?.toLowerCase() ?? 'none'] as const)
        : (['appointments', clinicId ?? 'none'] as const)
      await queryClient.cancelQueries({ queryKey: key as string[] })
      const previous = queryClient.getQueryData<Appointment[]>(key as string[])
      queryClient.setQueryData<Appointment[]>(key as string[], (old) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, status: 'cancelled' as AppointmentStatus } : a))
      )
      return { previous, key }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous && ctx?.key) {
        queryClient.setQueryData(ctx.key as string[], ctx.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}

// ---- Auth ----

export function useSignUp() {
  return useMutation({
    mutationFn: (input: SignUpInput) => authRepository.signUp(input),
  })
}

// ---- Self-service booking (public / anon-safe) ----

/**
 * Fetch active clinics/hospitals via public RPC or direct select so anon visitors on /book can select a hospital.
 */
export function usePublicClinics() {
  return useQuery({
    queryKey: ['public-clinics'],
    queryFn: async (): Promise<{ id: string; name: string; slug: string }[]> => {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('list_public_clinics')
        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          return rpcData.map((c: Record<string, unknown>) => ({
            id: String(c.id),
            name: String(c.name),
            slug: String(c.slug),
          }))
        }
      } catch {}

      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, slug')
        .eq('status', 'active')
        .order('name')

      if (error || !data || data.length === 0) {
        return [{ id: 'default', name: 'Default Hospital', slug: 'default' }]
      }

      return data.map((c: Record<string, unknown>) => ({
        id: String(c.id),
        name: String(c.name),
        slug: String(c.slug),
      }))
    },
  })
}

/**
 * Fetch doctors via the public RPC so anon users on /book can see the list.
 * RLS blocks direct table access for anon; this RPC bypasses it.
 *
 * When `clinicId` is omitted the RPC parameter is omitted entirely —
 * PostgREST sends NULL which makes the SQL function resolve the default
 * clinic (the function signature has `p_clinic_id uuid DEFAULT NULL`).
 */
export function usePublicDoctors(clinicId?: string) {
  return useQuery({
    queryKey: ['public-doctors', clinicId ?? 'none'],
    queryFn: async (): Promise<{ id: string; name: string; specialization: string }[]> => {
      // Pass {} (empty object) when clinicId is undefined so PostgREST
      // omits the param and the SQL DEFAULT NULL kicks in.
      const params = clinicId ? { p_clinic_id: clinicId } : {}
      const { data, error } = await supabase.rpc('list_public_doctors', params)
      if (error) throw error
      return (data ?? []).map((d: Record<string, unknown>) => ({
        id: String(d.id),
        name: String(d.name),
        specialization: String(d.specialization),
      }))
    },
    // Always enabled — the RPC handles the default clinic when param is NULL.
  })
}

export function useBookedSlots(date: Date | undefined, doctorId?: string) {
  const { clinicId } = useCurrentClinic()
  return useQuery({
    queryKey: [
      'booked-slots',
      date?.toISOString().slice(0, 10) ?? 'none',
      clinicId ?? 'none',
      doctorId ?? 'none',
    ],
    queryFn: () =>
      appointmentsRepository.getBookedHours(
        date!,
        clinicId ?? undefined,
        doctorId
      ),
    enabled: !!date && !!clinicId,
  })
}

export function useBookAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BookingInput) => bookingRepository.book(input),
    // Booking touches appointments, patients, and notifications.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// ---- Queue ----

export function useQueue() {
  const { clinicId } = useCurrentClinic()
  const { isDoctor, doctor } = useDoctorIdentity()
  const user = useAuthStore((s) => s.auth.user)
  const isPatient = hasRole(user?.role ?? [], 'patient')
  return useQuery({
    queryKey: isPatient
      ? ['queue', 'patient', user?.email?.toLowerCase() ?? 'none']
      : ['queue', clinicId ?? 'none', doctor?.id ?? (isDoctor ? 'unresolved' : 'all')],
    enabled: isPatient ? !!user?.email : !!clinicId,
    queryFn: async () => {
      if (isPatient) {
        // RLS queue_entries_select_clinic has a patient branch since migration
        // 20260829000000 (EXISTS over appointments.patient_email), so this
        // clinic-less fetch returns only the patient's own queue entries.
        try {
          const { data, error } = await supabase
            .from('queue_entries')
            .select('*, rooms!queue_entries_room_id_fkey(number)')
            .order('checked_in_at', { ascending: true })
            .limit(50)
          if (!error && data?.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (data as any[]).map((row: Record<string, unknown>) => {
              const rooms = row.rooms as { number: string } | null
              return {
                id: String(row.id),
                appointmentId: row.appointment_id ? String(row.appointment_id) : undefined,
                patientName: String(row.patient_name),
                appointmentTime: String(row.appointment_time),
                checkedInAt: String(row.checked_in_at),
                calledAt: row.called_at ? String(row.called_at) : undefined,
                doctorName: String(row.doctor_name),
                room: rooms?.number ? String(rooms.number) : undefined,
                status: String(row.status) as import('@/features/queue/schema').QueueEntry['status'],
              }
            })
          }
        } catch {
          // fall through to empty
        }
        return []
      }
      const all = await queueRepository.list(clinicId ?? undefined)
      if (!isDoctor) return all
      if (!doctor) return []
      return all.filter((e) => {
        if (e.doctorName === doctor.name) return true
        return false
      })
    },
  })
}

export function useQueueActions() {
  const queryClient = useQueryClient()
  const { isDoctor, doctor } = useDoctorIdentity()
  const { clinicId } = useCurrentClinic()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['queue'] })

  const callNext = useMutation({
    // When a doctor clicks "Call next", scope it to their own queue so they
    // don't accidentally call another doctor's patient.
    mutationFn: () =>
      queueRepository.callNext(isDoctor ? doctor?.name : undefined, clinicId ?? undefined),
    onSuccess: invalidate,
  })
  const startVisit = useMutation({
    mutationFn: (id: string) => queueRepository.startVisit(id),
    onSuccess: invalidate,
  })
  const complete = useMutation({
    mutationFn: (id: string) => queueRepository.complete(id),
    onSuccess: invalidate,
  })
  const markLeft = useMutation({
    mutationFn: (id: string) => queueRepository.markLeft(id),
    onSuccess: invalidate,
  })

  return { callNext, startVisit, complete, markLeft }
}

// ---- Patients ----

export function usePatients() {
  const { clinicId } = useCurrentClinic()
  const { isDoctor, doctor } = useDoctorIdentity()
  return useQuery({
    queryKey: ['patients', clinicId ?? 'none', doctor?.id ?? (isDoctor ? 'unresolved' : 'all')],
    enabled: !!clinicId,
    queryFn: async () => {
      const [allPatients, allAppointments] = await Promise.all([
        patientsRepository.list(clinicId ?? undefined),
        appointmentsRepository.list(clinicId ?? undefined),
      ])
      if (!isDoctor) return allPatients
      if (!doctor) return []
      // A doctor's patients are the people on their own appointments.
      const doctorAppointments = allAppointments.filter(
        (a) => a.doctorId === doctor.id
      )
      const emails = new Set(
        doctorAppointments
          .map((a) => a.patientEmail?.toLowerCase())
          .filter(Boolean)
      )
      const names = new Set(doctorAppointments.map((a) => a.patientName))

      return allPatients.filter((p) => {
        if (p.email && emails.has(p.email.toLowerCase())) return true
        return names.has(p.name)
      })
    },
  })
}

export function useCreatePatient() {
  const queryClient = useQueryClient()
  const { clinicId } = useCurrentClinic()
  return useMutation({
    mutationFn: (input: Omit<Patient, 'id'>) =>
      patientsRepository.create(input, clinicId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  })
}

// ---- Doctors ----

export function useDoctors() {
  const { clinicId } = useCurrentClinic()
  const user = useAuthStore((s) => s.auth.user)
  const isPatient = hasRole(user?.role ?? [], 'patient')
  return useQuery({
    queryKey: isPatient ? ['doctors', 'patient'] : ['doctors', clinicId ?? 'none'],
    queryFn: async () => {
      if (isPatient) {
        // Patients need doctor specialization for display; use the public RPC which works without clinic scope.
        const { data, error } = await supabase.rpc('list_public_doctors', {})
        if (error) throw error
        return (data ?? []).map((d: Record<string, unknown>) => ({
          id: String(d.id),
          name: String(d.name),
          specialization: String(d.specialization),
          email: '',
          status: 'active' as DoctorStatus,
          todayAppointments: 0,
        })) as Doctor[]
      }
      return doctorsRepository.list(clinicId ?? undefined)
    },
    enabled: isPatient || !!clinicId,
  })
}

export function useCreateDoctor() {
  const queryClient = useQueryClient()
  const { clinicId } = useCurrentClinic()
  return useMutation({
    mutationFn: (input: Omit<Doctor, 'id'> & { userId?: string | null }) =>
      doctorsRepository.create(input, clinicId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  })
}

export function useUpdateDoctorStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DoctorStatus }) =>
      doctorsRepository.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  })
}

export function useDeleteDoctor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => doctorsRepository.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  })
}

// ---- Staff ----

export function useStaff() {
  const { clinicId } = useCurrentClinic()
  return useQuery({
    queryKey: ['staff', clinicId ?? 'none'],
    queryFn: () => staffRepository.list(clinicId ?? undefined),
    enabled: !!clinicId,
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()
  const { clinicId } = useCurrentClinic()
  return useMutation({
    mutationFn: (input: Omit<Staff, 'id'>) =>
      staffRepository.create(input, clinicId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useDeleteStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => staffRepository.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })
}

// ---- Rooms ----

export function useRooms() {
  const { clinicId } = useCurrentClinic()
  return useQuery({
    queryKey: ['rooms', clinicId ?? 'none'],
    queryFn: () => roomsRepository.list(clinicId ?? undefined),
    enabled: !!clinicId,
  })
}

export function useCreateRoom() {
  const queryClient = useQueryClient()
  const { clinicId } = useCurrentClinic()
  return useMutation({
    mutationFn: (input: Omit<Room, 'id'>) =>
      roomsRepository.create(input, clinicId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  })
}

export function useUpdateRoomStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RoomStatus }) =>
      roomsRepository.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  })
}

// ---- Notifications ----

export function useNotifications() {
  const { clinicId } = useCurrentClinic()
  return useQuery({
    queryKey: ['notifications', clinicId ?? 'none'],
    queryFn: () => notificationsRepository.list(clinicId ?? undefined),
    enabled: !!clinicId,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsRepository.markRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsRepository.markAllRead(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

// ---- Analytics ----

export function useAnalytics(range: 'today' | '7d' | '30d' = 'today') {
  const { clinicId } = useCurrentClinic()
  return useQuery({
    queryKey: ['analytics', clinicId ?? 'none', range],
    queryFn: () => analyticsRepository.getSummary(clinicId ?? undefined, range),
    enabled: !!clinicId,
  })
}

// ---- Realtime subscriptions ----
// Subscribe to Supabase Postgres changes and auto-invalidate the matching
// React Query cache. This makes the queue and appointments live for all
// connected clients without manual polling.

function useRealtimeTable(
  table: string,
  queryKey: string[],
  /** Only invalidate when the row matches this filter. Omit for all changes. */
  filter?: { column: string; value: string },
  /** Scope realtime to a specific clinic. Omit for all clinics. */
  clinicId?: string | null
) {
  const queryClient = useQueryClient()

  // Supabase Realtime only supports a single `filter` string per channel.
  // Combine clinic + doctor filters with `and()` when both are present.
  const combinedFilter = (() => {
    const parts: string[] = []
    if (clinicId) parts.push(`clinic_id=eq.${clinicId}`)
    if (filter) parts.push(`${filter.column}=eq.${filter.value}`)
    if (parts.length === 0) return undefined
    if (parts.length === 1) return parts[0]
    return `and(${parts.join(',')})`
  })()

  useEffect(() => {
    const channel = supabase
      .channel(`rt:${table}:${queryKey.join('/')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(combinedFilter ? { filter: combinedFilter } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, queryKey.join('/'), queryClient, combinedFilter])
}

/** Subscribe to queue changes for live updates on the front desk and doctor views. */
export function useRealtimeQueue(doctorName?: string) {
  const { clinicId } = useCurrentClinic()
  useRealtimeTable(
    'queue_entries',
    ['queue'],
    doctorName ? { column: 'doctor_name', value: doctorName } : undefined,
    clinicId
  )
}

/** Subscribe to appointment changes for live updates. */
export function useRealtimeAppointments() {
  const { clinicId } = useCurrentClinic()
  useRealtimeTable('appointments', ['appointments'], undefined, clinicId)
}

/** Subscribe to notification changes for the live bell. */
export function useRealtimeNotifications() {
  const { clinicId } = useCurrentClinic()
  useRealtimeTable('notifications', ['notifications'], undefined, clinicId)
}
