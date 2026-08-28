/**
 * Supabase-backed repository implementations.
 *
 * Each function maps 1:1 to the interfaces in `src/data/repos.ts`. The
 * column mapping is: DB snake_case → frontend camelCase. The `Database`
 * type below mirrors the exact tables and columns from the init migration.
 */
import { supabase } from '@/lib/supabase'
import {
  type Appointment,
  type AppointmentStatus,
} from '@/features/appointments/schema'
import { type Doctor, type DoctorStatus } from '@/features/doctors/schema'
import { type AppNotification } from '@/features/notifications/schema'
import { type Patient } from '@/features/patients/schema'
import { type QueueEntry } from '@/features/queue/schema'
import { type Room, type RoomStatus } from '@/features/rooms/schema'
import { type Staff } from '@/features/staff/schema'
import {
  type AppointmentsRepository,
  type AuthRepository,
  type BookingRepository,
  type DoctorsRepository,
  type NotificationsRepository,
  type PatientsRepository,
  type QueueRepository,
  type RoomsRepository,
  type StaffRepository,
} from '../repos'
import {
  aggregateByStatus,
  calcAvgWaitMinutes,
} from '@/features/dashboard/components/analytics-helpers'

// ---------------------------------------------------------------------------
// Row → frontend mappers
// ---------------------------------------------------------------------------

function mapAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    patientName: String(row.patient_name),
    patientEmail: row.patient_email ? String(row.patient_email) : undefined,
    doctorId: row.doctor_id ? String(row.doctor_id) : '',
    doctorName: row.doctor_name ? String(row.doctor_name) : '',
    scheduledFor: String(row.scheduled_for),
    status: String(row.status) as AppointmentStatus,
    reason: row.reason ? String(row.reason) : undefined,
    rejectionReason: row.rejection_reason
      ? String(row.rejection_reason)
      : undefined,
  }
}

function mapQueueEntry(row: Record<string, unknown>): QueueEntry {
  return {
    id: String(row.id),
    appointmentId: row.appointment_id ? String(row.appointment_id) : undefined,
    patientName: String(row.patient_name),
    appointmentTime: String(row.appointment_time),
    checkedInAt: String(row.checked_in_at),
    calledAt: row.called_at ? String(row.called_at) : undefined,
    doctorName: String(row.doctor_name),
    room: row.room_number ? String(row.room_number) : undefined,
    status: String(row.status) as QueueEntry['status'],
  }
}

function mapPatient(row: Record<string, unknown>): Patient {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone),
    email: row.email ? String(row.email) : undefined,
    lastVisit: row.last_visit ? String(row.last_visit) : null,
    visits: Number(row.visits),
  }
}

function mapDoctor(row: Record<string, unknown>): Doctor {
  return {
    id: String(row.id),
    name: String(row.name),
    specialization: String(row.specialization),
    email: String(row.email),
    status: String(row.status) as DoctorStatus,
    todayAppointments: Number(row.today_appointments ?? 0),
  }
}

function mapStaff(row: Record<string, unknown>): Staff {
  return {
    id: String(row.id),
    name: String(row.name),
    role: String(row.role) as Staff['role'],
    phone: String(row.phone),
    email: String(row.email),
    status: String(row.status) as Staff['status'],
  }
}

function mapRoom(row: Record<string, unknown>): Room {
  return {
    id: String(row.id),
    number: String(row.number),
    type: String(row.type) as Room['type'],
    status: String(row.status) as RoomStatus,
    doctorName: row.doctor_name ? String(row.doctor_name) : undefined,
    patientName: row.patient_name ? String(row.patient_name) : undefined,
  }
}

function mapNotification(
  row: Record<string, unknown>,
  read: boolean
): AppNotification {
  return {
    id: String(row.id),
    type: String(row.type) as AppNotification['type'],
    channel: String(row.channel) as AppNotification['channel'],
    title: String(row.title),
    message: String(row.message),
    createdAt: String(row.created_at),
    read,
  }
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export const appointmentsRepository: AppointmentsRepository = {
  async list(clinicId?: string) {
    // Fail-closed: without a clinic scope we would otherwise list all clinics
    // (RLS bypass for admins). Return empty instead of leaking cross-tenant data.
    if (!clinicId) return []
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('scheduled_for', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapAppointment)
  },

  async create(input, clinicId?: string) {
    if (!clinicId) throw new Error('Missing clinic context')
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_name: input.patientName,
        patient_email: input.patientEmail ?? null,
        doctor_id: input.doctorId || null,
        doctor_name: input.doctorName,
        scheduled_for: input.scheduledFor,
        reason: input.reason ?? null,
        status: 'booked',
        clinic_id: clinicId,
      })
      .select()
      .single()

    if (error) throw error
    return mapAppointment(data)
  },

  async getBookedHours(
    date: Date,
    clinicId?: string,
    doctorId?: string
  ): Promise<number[]> {
    // Fail-closed: require clinic scope; otherwise would return hours from all clinics.
    if (!clinicId) return []
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    let query = supabase
      .from('appointments')
      .select('scheduled_for, doctor_id, status')
      .gte('scheduled_for', start.toISOString())
      .lte('scheduled_for', end.toISOString())
      .in('status', ['pending', 'booked', 'arrived', 'in_progress'])
      .eq('clinic_id', clinicId)
    if (doctorId && doctorId !== 'no_preference')
      query = query.eq('doctor_id', doctorId)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(
      (r) => new Date(r.scheduled_for as string).getHours()
    )
  },

  async updateStatus(id, status) {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)

    if (error) throw error
  },

  async approve(id, doctor) {
    const update: Record<string, unknown> = { status: 'booked' }
    if (doctor) {
      update.doctor_id = doctor.id
      update.doctor_name = doctor.name
    }
    const { error } = await supabase
      .from('appointments')
      .update(update)
      .eq('id', id)

    if (error) throw error
  },

  async reject(id, reason) {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'rejected', rejection_reason: reason ?? null })
      .eq('id', id)

    if (error) throw error
  },
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export const queueRepository: QueueRepository = {
  async list(clinicId?: string) {
    // Fail-closed: do not leak queue entries across clinics.
    if (!clinicId) return []
    // Join rooms to get the room number for display.
    const { data, error } = await supabase
      .from('queue_entries')
      .select('*, rooms!queue_entries_room_id_fkey(number)')
      .eq('clinic_id', clinicId)
      .order('checked_in_at', { ascending: true })

    if (error) throw error

    return (data ?? []).map((row: Record<string, unknown>) => {
      const rooms = row.rooms as { number: string } | null
      return mapQueueEntry({ ...row, room_number: rooms?.number ?? null })
    })
  },

  async callNext(doctorName?: string, clinicId?: string) {
    // Use the atomic RPC (FOR UPDATE SKIP LOCKED) to prevent two desks
    // from calling the same patient simultaneously.
    const { error } = await supabase.rpc('call_next_in_queue', {
      p_clinic_id: clinicId ?? null,
      p_doctor_name: doctorName ?? null,
    })

    if (error) throw error
  },

  async startVisit(id) {
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'in_room' })
      .eq('id', id)

    if (error) throw error
  },

  async complete(id) {
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'done' })
      .eq('id', id)

    if (error) throw error
  },

  async markLeft(id) {
    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'left' })
      .eq('id', id)

    if (error) throw error
  },
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export const patientsRepository: PatientsRepository = {
  async list(clinicId?: string) {
    if (!clinicId) return []
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name')

    if (error) throw error
    return (data ?? []).map(mapPatient)
  },

  async create(input, clinicId?: string) {
    if (!clinicId) throw new Error('Missing clinic context')
    const { data, error } = await supabase
      .from('patients')
      .insert({
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        last_visit: input.lastVisit ?? null,
        visits: input.visits,
        clinic_id: clinicId,
      })
      .select()
      .single()

    if (error) throw error
    return mapPatient(data)
  },
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

export const doctorsRepository: DoctorsRepository = {
  async list(clinicId?: string) {
    if (!clinicId) return []
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name')

    if (error) throw error
    if (!doctors?.length) return []

    const doctorIds = doctors.map((d: Record<string, unknown>) => d.id)
    const { data: counts } = await supabase
      .from('appointments')
      .select('doctor_id')
      .in('doctor_id', doctorIds)
      .gte('scheduled_for', todayStart.toISOString())
      .lte('scheduled_for', todayEnd.toISOString())
      .not('status', 'in', '("cancelled","rejected")')
      .eq('clinic_id', clinicId)

    const countMap = new Map<string, number>()
    for (const c of (counts ?? []) as { doctor_id: string }[]) {
      countMap.set(c.doctor_id, (countMap.get(c.doctor_id) ?? 0) + 1)
    }

    return doctors.map((d: Record<string, unknown>) =>
      mapDoctor({ ...d, today_appointments: countMap.get(String(d.id)) ?? 0 })
    )
  },

  async create(input, clinicId?: string) {
    if (!clinicId) throw new Error('Missing clinic context')
    const { data, error } = await supabase
      .from('doctors')
      .insert({
        name: input.name,
        specialization: input.specialization,
        email: input.email,
        status: input.status,
        clinic_id: clinicId,
      })
      .select()
      .single()

    if (error) throw error
    return mapDoctor({ ...data, today_appointments: 0 })
  },

  async updateStatus(id, status) {
    const { error } = await supabase
      .from('doctors')
      .update({ status })
      .eq('id', id)

    if (error) throw error
  },

  async delete(id) {
    const { error } = await supabase.from('doctors').delete().eq('id', id)
    if (error) throw error
  },
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export const staffRepository: StaffRepository = {
  async list(clinicId?: string) {
    if (!clinicId) return []
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name')

    if (error) throw error
    return (data ?? []).map(mapStaff)
  },

  async create(input, clinicId?: string) {
    if (!clinicId) throw new Error('Missing clinic context')
    const { data, error } = await supabase
      .from('staff')
      .upsert(
        {
          name: input.name,
          role: input.role,
          phone: input.phone,
          email: input.email,
          status: input.status,
          clinic_id: clinicId,
        },
        { onConflict: 'email' }
      )
      .select()
      .single()

    if (error) throw error
    return mapStaff(data)
  },

  async delete(id) {
    const { error } = await supabase.from('staff').delete().eq('id', id)
    if (error) throw error
  },
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const roomsRepository: RoomsRepository = {
  async list(clinicId?: string) {
    if (!clinicId) return []
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('number')

    if (error) throw error
    if (!rooms?.length) return []

    const roomIds = rooms.map((r: Record<string, unknown>) => r.id)
    const { data: entries } = await supabase
      .from('queue_entries')
      .select('room_id, doctor_name, patient_name')
      .in('room_id', roomIds)
      .eq('status', 'in_room')
      .eq('clinic_id', clinicId)

    const occupancyMap = new Map<
      string,
      { doctor_name: string; patient_name: string }
    >()
    for (const e of (entries ?? []) as {
      room_id: string
      doctor_name: string
      patient_name: string
    }[]) {
      occupancyMap.set(e.room_id, {
        doctor_name: e.doctor_name,
        patient_name: e.patient_name,
      })
    }

    return rooms.map((r: Record<string, unknown>) => {
      const occ = occupancyMap.get(String(r.id))
      return mapRoom({
        ...r,
        doctor_name: occ?.doctor_name ?? null,
        patient_name: occ?.patient_name ?? null,
      })
    })
  },

  async create(input, clinicId?: string) {
    if (!clinicId) throw new Error('Missing clinic context')
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        number: input.number,
        type: input.type,
        status: input.status,
        clinic_id: clinicId,
      })
      .select()
      .single()

    if (error) throw error
    return mapRoom(data)
  },

  async updateStatus(id, status) {
    const { error } = await supabase
      .from('rooms')
      .update({ status })
      .eq('id', id)

    if (error) throw error
  },
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notificationsRepository: NotificationsRepository = {
  async list(clinicId?: string) {
    // Fail-closed: without clinicId we would leak notifications across tenants.
    if (!clinicId) return []
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    // Get notifications — scoped to clinic when clinicId is provided.
    // Then join read status for the current user.
    const { data: notifs, error: notifErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (notifErr) throw notifErr

    const allNotifs = notifs ?? []
    if (allNotifs.length === 0) return []

    // Fetch the user's read status for these notifications.
    const notifIds = allNotifs.map((n: { id: string }) => n.id)
    const { data: recipients } = await supabase
      .from('notification_recipients')
      .select('notification_id, read')
      .eq('user_id', user.id)
      .in('notification_id', notifIds)

    const readMap = new Map<string, boolean>()
    for (const r of (recipients ?? []) as {
      notification_id: string
      read: boolean
    }[]) {
      readMap.set(r.notification_id, r.read)
    }

    return (notifs ?? []).map((n: Record<string, unknown>) =>
      mapNotification(n, readMap.get(String(n.id)) ?? false)
    )
  },

  async markRead(id) {
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: id,
    })
    if (error) throw error
  },

  async markAllRead() {
    const { error } = await supabase.rpc('mark_all_notifications_read')
    if (error) throw error
  },
}

// ---------------------------------------------------------------------------
// Booking (public, anonymous-safe RPC)
// ---------------------------------------------------------------------------

export const bookingRepository: BookingRepository = {
  async book(input) {
    const { data: apt, error } = await supabase.rpc('book_appointment', {
      p_name: input.patientName,
      p_email: input.email,
      p_phone: input.phone,
      p_scheduled_for: input.scheduledFor,
      p_doctor_id: input.doctorId ?? null,
      p_reason: input.reason ?? null,
      p_clinic_id: input.clinicId ?? null,
    })

    if (error) throw error
    if (!apt) throw new Error('Booking failed to return appointment data.')

    return {
      appointment: mapAppointment(apt),
      hasAccount: false,
    }
  },
}

// ---------------------------------------------------------------------------
// Auth (sign-up via Supabase Auth)
// ---------------------------------------------------------------------------

export const authRepository: AuthRepository = {
  async signUp(input) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
        },
      },
    })

    if (error) throw error
    if (!data.user) throw new Error('Sign-up failed — no user returned.')

    // The handle_new_user() trigger auto-creates a profile with role
    // 'patient'. We fetch it to return the role.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    // Also create a patient directory record so the patient appears in the
    // admin Patients page immediately — not just after their first booking.
    // Use a plain insert; if the patient already exists (duplicate email), we
    // silently ignore the conflict rather than using onConflict which fails
    // against a partial unique index on lower(email).
    if (input.name && input.phone) {
      const { error: patientErr } = await supabase.from('patients').insert({
        name: input.name,
        phone: input.phone,
        email: input.email,
        visits: 0,
      })
      // Duplicate email is expected — the patient was already in the directory.
      if (patientErr && !patientErr.message?.includes('duplicate')) {
        console.error('Failed to create patient record:', patientErr)
      }
    }

    return {
      email: data.user.email ?? input.email,
      role: profile ? [String(profile.role)] : ['patient'],
    }
  },
}

// ---------------------------------------------------------------------------
// Analytics (pure aggregations over existing tables — no new tables)
// ---------------------------------------------------------------------------

export type AnalyticsRange = 'today' | '7d' | '30d'

export interface AnalyticsSummary {
  today: {
    booked: number
    completed: number
    pending: number
    noShow: number
    cancelled: number
    rejected: number
    total: number
  }
  trend: Array<{ date: string; booked: number; completed: number }>
  byStatus: Array<{ name: string; value: number }>
  byDoctor: Array<{ name: string; completed: number }>
  avgWaitMinutes: number | null
}

function rangeToInterval(range: AnalyticsRange) {
  const now = new Date()
  switch (range) {
    case 'today': {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return { start, end: now }
    }
    case '7d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { start, end: now }
    }
    case '30d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { start, end: now }
    }
  }
}

export const analyticsRepository = {
  async getSummary(
    clinicId?: string,
    range: AnalyticsRange = 'today',
  ): Promise<AnalyticsSummary> {
    // Fail-closed: analytics without clinic scope would aggregate all tenants.
    if (!clinicId) throw new Error('Missing clinic context')
    const { start, end } = rangeToInterval(range)

    // --- Appointments in range ---
    const { data: apts, error: aptErr } = await supabase
      .from('appointments')
      .select('status, doctor_name, scheduled_for')
      .gte('scheduled_for', start.toISOString())
      .lte('scheduled_for', end.toISOString())
      .eq('clinic_id', clinicId)
    if (aptErr) throw aptErr

    const rows = (apts ?? []) as Array<{
      status: string
      doctor_name: string
      scheduled_for: string
    }>

    // Today counts (for "today" range the query already scopes to today;
    // for other ranges we still want today's snapshot separately).
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const { data: todayRows } = await supabase
      .from('appointments')
      .select('status')
      .gte('scheduled_for', todayStart.toISOString())
      .lte('scheduled_for', todayEnd.toISOString())
      .eq('clinic_id', clinicId)

    const todayList = (todayRows ?? []) as Array<{ status: string }>

    const today = {
      booked: todayList.filter((r) => r.status === 'booked').length,
      completed: todayList.filter((r) => r.status === 'completed').length,
      pending: todayList.filter((r) => r.status === 'pending').length,
      noShow: todayList.filter((r) => r.status === 'no_show').length,
      cancelled: todayList.filter((r) => r.status === 'cancelled').length,
      rejected: todayList.filter((r) => r.status === 'rejected').length,
      total: todayList.length,
    }

    // Trend: group by date (YYYY-MM-DD)
    const trendMap = new Map<
      string,
      { booked: number; completed: number }
    >()
    for (const r of rows) {
      const day = r.scheduled_for.slice(0, 10)
      const entry = trendMap.get(day) ?? { booked: 0, completed: 0 }
      if (r.status === 'booked') entry.booked++
      if (r.status === 'completed') entry.completed++
      trendMap.set(day, entry)
    }
    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }))

    // By status (from range rows)
    const byStatus = aggregateByStatus(rows)

    // By doctor: completed count per doctor
    const doctorMap = new Map<string, number>()
    for (const r of rows) {
      if (r.status === 'completed' && r.doctor_name) {
        doctorMap.set(
          r.doctor_name,
          (doctorMap.get(r.doctor_name) ?? 0) + 1,
        )
      }
    }
    const byDoctor = [...doctorMap.entries()]
      .map(([name, completed]) => ({ name, completed }))
      .sort((a, b) => b.completed - a.completed)

    // Average wait minutes from queue_entries in range
    const { data: queueRows, error: queueErr } = await supabase
      .from('queue_entries')
      .select('checked_in_at, called_at, status')
      .gte('checked_in_at', start.toISOString())
      .lte('checked_in_at', end.toISOString())
      .eq('clinic_id', clinicId)

    if (queueErr) throw queueErr

    const avgWaitMinutes = calcAvgWaitMinutes(
      (queueRows ?? []) as Array<{
        checked_in_at: string
        called_at: string | null
        status: string
      }>,
    )

    return { today, trend, byStatus, byDoctor, avgWaitMinutes }
  },
}
