/**
 * Repository interfaces + mock implementations.
 *
 * Pages talk to these through the react-query hooks in `src/data/hooks.ts`,
 * never to the seeds or the store directly. When the backend lands, swap the
 * mock implementations for axios-backed ones (same interfaces) in
 * `src/data/index.ts` and the UI does not change.
 */
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
import { createAccount, getAccount } from './mock/accounts'
import { useDataStore } from './mock/store'

// Simulated network latency so loading states are visible and real.
const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

export interface AppointmentsRepository {
  list: () => Promise<Appointment[]>
  create: (input: Omit<Appointment, 'id' | 'status'>) => Promise<Appointment>
  updateStatus: (id: string, status: AppointmentStatus) => Promise<void>
  /** Approve a pending request; optionally assign a doctor at the same time. */
  approve: (id: string, doctor?: { id: string; name: string }) => Promise<void>
  /** Reject a pending request, with an optional reason for the patient. */
  reject: (id: string, reason?: string) => Promise<void>
}

export interface QueueRepository {
  list: () => Promise<QueueEntry[]>
  /** Call the next waiting patient. Pass doctorName to scope to a doctor's queue. */
  callNext: (doctorName?: string) => Promise<void>
  startVisit: (id: string) => Promise<void>
  complete: (id: string) => Promise<void>
  markLeft: (id: string) => Promise<void>
}

export interface PatientsRepository {
  list: () => Promise<Patient[]>
  create: (input: Omit<Patient, 'id'>) => Promise<Patient>
}

export interface DoctorsRepository {
  list: () => Promise<Doctor[]>
  create: (input: Omit<Doctor, 'id'>) => Promise<Doctor>
  updateStatus: (id: string, status: DoctorStatus) => Promise<void>
  delete: (id: string) => Promise<void>
}

export interface StaffRepository {
  list: () => Promise<Staff[]>
  create: (input: Omit<Staff, 'id'>) => Promise<Staff>
  delete: (id: string) => Promise<void>
}

export interface RoomsRepository {
  list: () => Promise<Room[]>
  create: (input: Omit<Room, 'id'>) => Promise<Room>
  updateStatus: (id: string, status: RoomStatus) => Promise<void>
}

export interface NotificationsRepository {
  list: () => Promise<AppNotification[]>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

/**
 * Self-service booking: a visitor books without signing up. The repository
 * creates the appointment as a pending request (and patient record) for
 * staff to approve; it does not create an account — the visitor sets their
 * own password right after, using the email they already provided.
 *
 * In production this maps to a Supabase edge function that inserts the
 * patient + appointment atomically. See docs/architecture.md.
 */
export interface BookingRepository {
  book: (input: BookingInput) => Promise<BookingResult>
}

/**
 * Sign-up: the visitor creates an account with the email they provided at
 * booking (or on the sign-up page). Any further onboarding information is
 * collected here as well.
 */
export interface AuthRepository {
  signUp: (input: SignUpInput) => Promise<{ email: string; role: string[] }>
}

export interface SignUpInput {
  /** Optional — booking already collected the full name; sign-up defaults it. */
  name?: string
  email: string
  password: string
  phone?: string
}

export interface BookingInput {
  patientName: string
  email: string
  phone: string
  /** Optional — patients may not know a doctor by name; the clinic assigns. */
  doctorId?: string
  doctorName?: string
  scheduledFor: string // ISO 8601
  reason?: string
}

export interface BookingResult {
  appointment: Appointment
  /** Whether an account already exists for the booking email. */
  hasAccount: boolean
}

export const appointmentsRepository: AppointmentsRepository = {
  async list() {
    await delay()
    return useDataStore.getState().appointments
  },
  async create(input) {
    await delay(150)
    return useDataStore.getState().addAppointment(input)
  },
  async updateStatus(id, status) {
    await delay(150)
    useDataStore.getState().updateAppointmentStatus(id, status)
  },
  async approve(id, doctor) {
    await delay(150)
    useDataStore.getState().approveAppointment(id, doctor)
  },
  async reject(id, reason) {
    await delay(150)
    useDataStore.getState().rejectAppointment(id, reason)
  },
}

export const queueRepository: QueueRepository = {
  async list() {
    await delay()
    return useDataStore.getState().queue
  },
  async callNext(doctorName?: string) {
    await delay(150)
    useDataStore.getState().callNext(doctorName)
  },
  async startVisit(id) {
    await delay(150)
    useDataStore.getState().startVisit(id)
  },
  async complete(id) {
    await delay(150)
    useDataStore.getState().completeVisit(id)
  },
  async markLeft(id) {
    await delay(150)
    useDataStore.getState().markLeft(id)
  },
}

export const patientsRepository: PatientsRepository = {
  async list() {
    await delay()
    return useDataStore.getState().patients
  },
  async create(input) {
    await delay(150)
    return useDataStore.getState().addPatient(input)
  },
}

export const doctorsRepository: DoctorsRepository = {
  async list() {
    await delay()
    return useDataStore.getState().doctors
  },
  async create(input) {
    await delay(150)
    return useDataStore.getState().addDoctor(input)
  },
  async updateStatus(id, status) {
    await delay(150)
    useDataStore.getState().setDoctorStatus(id, status)
  },
  async delete(id) {
    await delay(150)
    useDataStore.getState().removeDoctor(id)
  },
}

export const staffRepository: StaffRepository = {
  async list() {
    await delay()
    return useDataStore.getState().staff
  },
  async create(input) {
    await delay(150)
    return useDataStore.getState().addStaff(input)
  },
  async delete(id) {
    await delay(150)
    useDataStore.getState().removeStaff(id)
  },
}

export const roomsRepository: RoomsRepository = {
  async list() {
    await delay()
    return useDataStore.getState().rooms
  },
  async create(input) {
    await delay(150)
    return useDataStore.getState().addRoom(input)
  },
  async updateStatus(id, status) {
    await delay(150)
    useDataStore.getState().setRoomStatus(id, status)
  },
}

export const bookingRepository: BookingRepository = {
  async book(input) {
    await delay(300)
    const { appointment } = useDataStore.getState().bookAppointment(input)
    // Booking never provisions an account — the visitor creates their own
    // password afterwards. We just report whether they already have one.
    return {
      appointment,
      hasAccount: Boolean(getAccount(input.email)),
    }
  },
}

export const authRepository: AuthRepository = {
  async signUp(input) {
    await delay(250)
    // Production: `auth.signUp({ email, password })` + insert a profiles row.
    if (getAccount(input.email)) {
      throw new Error('An account already exists for this email.')
    }
    const { account } = createAccount({
      name: input.name,
      email: input.email,
      password: input.password,
    })
    return { email: account.email, role: account.role }
  },
}

export const notificationsRepository: NotificationsRepository = {
  async list() {
    await delay()
    return useDataStore.getState().notifications
  },
  async markRead(id) {
    await delay(150)
    useDataStore.getState().markNotificationRead(id)
  },
  async markAllRead() {
    await delay(150)
    useDataStore.getState().markAllNotificationsRead()
  },
}
