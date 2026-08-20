/**
 * Supabase-backed repository implementations.
 *
 * Each function maps 1:1 to the interfaces in `src/data/repos.ts`. The
 * column mapping is: DB snake_case → frontend camelCase. The `Database`
 * type below mirrors the exact tables and columns from the init migration.
 */
import { supabase, supabaseAdmin } from '@/lib/supabase'
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
    appointmentId: row.appointment_id
      ? String(row.appointment_id)
      : undefined,
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
  async list() {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('scheduled_for', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapAppointment)
  },

  async create(input) {
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_name: input.patientName,
        patient_email: input.patientEmail ?? null,
        doctor_id: input.doctorId || null,
        doctor_name: input.doctorName,
        scheduled_for: input.scheduledFor,
        reason: input.reason ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return mapAppointment(data)
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
  async list() {
    // Join rooms to get the room number for display.
    const { data, error } = await supabase
      .from('queue_entries')
      .select('*, rooms!queue_entries_room_id_fkey(number)')
      .order('checked_in_at', { ascending: true })

    if (error) throw error

    return (data ?? []).map((row: Record<string, unknown>) => {
      const rooms = row.rooms as { number: string } | null
      return mapQueueEntry({ ...row, room_number: rooms?.number ?? null })
    })
  },

  async callNext(doctorName?: string) {
    // Find the earliest waiting entry, optionally scoped to a specific doctor.
    let query = supabase
      .from('queue_entries')
      .select('id')
      .eq('status', 'waiting')
      .order('checked_in_at', { ascending: true })
      .limit(1)

    if (doctorName) {
      query = query.eq('doctor_name', doctorName)
    }

    const { data: next, error: findErr } = await query.single()

    if (findErr || !next) return

    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'called', called_at: new Date().toISOString() })
      .eq('id', next.id)

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
  async list() {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('name')

    if (error) throw error
    return (data ?? []).map(mapPatient)
  },

  async create(input) {
    const { data, error } = await supabase
      .from('patients')
      .insert({
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        last_visit: input.lastVisit ?? null,
        visits: input.visits,
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
  async list() {
    // Compute todayAppointments via a count subquery.
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('*')
      .order('name')

    if (error) throw error
    if (!doctors?.length) return []

    // Batch-count today's appointments per doctor.
    const doctorIds = doctors.map((d: Record<string, unknown>) => d.id)
    const { data: counts } = await supabase
      .from('appointments')
      .select('doctor_id')
      .in('doctor_id', doctorIds)
      .gte('scheduled_for', todayStart.toISOString())
      .lte('scheduled_for', todayEnd.toISOString())
      .not('status', 'in', '("cancelled","rejected")')

    const countMap = new Map<string, number>()
    for (const c of (counts ?? []) as { doctor_id: string }[]) {
      countMap.set(c.doctor_id, (countMap.get(c.doctor_id) ?? 0) + 1)
    }

    return doctors.map(
      (d: Record<string, unknown>) =>
        mapDoctor({ ...d, today_appointments: countMap.get(String(d.id)) ?? 0 })
    )
  },

  async create(input) {
    const { data, error } = await supabase
      .from('doctors')
      .insert({
        name: input.name,
        specialization: input.specialization,
        email: input.email,
        status: input.status,
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
  async list() {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('name')

    if (error) throw error
    return (data ?? []).map(mapStaff)
  },

  async create(input) {
    const { data, error } = await supabase
      .from('staff')
      .upsert(
        {
          name: input.name,
          role: input.role,
          phone: input.phone,
          email: input.email,
          status: input.status,
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
  async list() {
    // Rooms don't store doctor/patient names — derive from queue_entries
    // where a queue entry is in_room for this room.
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .order('number')

    if (error) throw error
    if (!rooms?.length) return []

    const roomIds = rooms.map((r: Record<string, unknown>) => r.id)
    const { data: entries } = await supabase
      .from('queue_entries')
      .select('room_id, doctor_name, patient_name')
      .in('room_id', roomIds)
      .eq('status', 'in_room')

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

  async create(input) {
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        number: input.number,
        type: input.type,
        status: input.status,
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
  async list() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    // Get all notifications visible to this user (staff see clinic-wide;
    // patients see their own via recipients). Then join read status.
    const { data: notifs, error: notifErr } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })

    if (notifErr) throw notifErr

    // Fetch the user's read status for these notifications.
    const notifIds = (notifs ?? []).map((n: { id: string }) => n.id)
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
    // Call the book_appointment() RPC — status is locked to 'pending'
    // server-side, email is lowercased, doctor name resolved from DB.
    // The RPC now returns the full appointment record, bypassing RLS issues.
    const { data: apt, error } = await supabase.rpc(
      'book_appointment',
      {
        p_name: input.patientName,
        p_email: input.email,
        p_phone: input.phone,
        p_scheduled_for: input.scheduledFor,
        p_doctor_id: input.doctorId ?? null,
        p_reason: input.reason ?? null,
      }
    )

    if (error) throw error
    if (!apt) throw new Error('Booking failed to return appointment data.')

    // Check if an account already exists for this email.
    const { data: existingUser } = await supabase.auth.getUser()
    const hasAccount = existingUser?.user?.email === input.email.toLowerCase()

    return {
      appointment: mapAppointment(apt),
      hasAccount,
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
        data: input.name ? { name: input.name } : undefined,
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

    return {
      email: data.user.email ?? input.email,
      role: profile ? [String(profile.role)] : ['patient'],
    }
  },
}
