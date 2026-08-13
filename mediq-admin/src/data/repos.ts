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
import { useDataStore } from './mock/store'

// Simulated network latency so loading states are visible and real.
const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

export interface AppointmentsRepository {
  list: () => Promise<Appointment[]>
  create: (input: Omit<Appointment, 'id' | 'status'>) => Promise<Appointment>
  updateStatus: (id: string, status: AppointmentStatus) => Promise<void>
}

export interface QueueRepository {
  list: () => Promise<QueueEntry[]>
  callNext: () => Promise<void>
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
}

export interface StaffRepository {
  list: () => Promise<Staff[]>
  create: (input: Omit<Staff, 'id'>) => Promise<Staff>
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
}

export const queueRepository: QueueRepository = {
  async list() {
    await delay()
    return useDataStore.getState().queue
  },
  async callNext() {
    await delay(150)
    useDataStore.getState().callNext()
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
