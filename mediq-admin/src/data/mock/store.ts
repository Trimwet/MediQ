import { create } from 'zustand'
import {
  type Appointment,
  type AppointmentStatus,
} from '@/features/appointments/schema'
import { type Doctor, type DoctorStatus } from '@/features/doctors/schema'
import { type AppNotification } from '@/features/notifications/schema'
import { type Patient } from '@/features/patients/schema'
import { type QueueEntry, type QueueStatus } from '@/features/queue/schema'
import { type Room, type RoomStatus } from '@/features/rooms/schema'
import { type Staff } from '@/features/staff/schema'
import {
  seedAppointments,
  seedDoctors,
  seedNotifications,
  seedPatients,
  seedQueue,
  seedRooms,
  seedStaff,
} from './seeds'

// Bare identifiers — the facility label ('Room', 'Office', ...) is applied
// at render time via the facility store.
export const queueRooms = ['1', '2', '3', '4'] as const

type DataState = {
  appointments: Appointment[]
  queue: QueueEntry[]
  patients: Patient[]
  doctors: Doctor[]
  staff: Staff[]
  rooms: Room[]
  roomCursor: number
  notifications: AppNotification[]

  addAppointment: (input: Omit<Appointment, 'id' | 'status'>) => Appointment
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void

  addQueueEntry: (input: {
    appointmentId: string
    patientName: string
    doctorName: string
    appointmentTime: string
  }) => void
  callNext: () => void
  startVisit: (id: string) => void
  completeVisit: (id: string) => void
  markLeft: (id: string) => void

  addPatient: (input: Omit<Patient, 'id'>) => Patient
  addDoctor: (input: Omit<Doctor, 'id'>) => Doctor
  setDoctorStatus: (id: string, status: DoctorStatus) => void
  addStaff: (input: Omit<Staff, 'id'>) => Staff
  addRoom: (input: Omit<Room, 'id'>) => Room
  setRoomStatus: (id: string, status: RoomStatus) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
}

export const useDataStore = create<DataState>()((set) => ({
  appointments: seedAppointments,
  queue: seedQueue,
  patients: seedPatients,
  doctors: seedDoctors,
  staff: seedStaff,
  rooms: seedRooms,
  roomCursor: 0,
  notifications: seedNotifications,

  addAppointment: (input) => {
    const appointment: Appointment = {
      ...input,
      id: `apt-${Date.now()}`,
      status: 'booked',
    }
    set((state) => ({ appointments: [appointment, ...state.appointments] }))
    return appointment
  },

  updateAppointmentStatus: (id, status) =>
    set((state) => {
      const appointments = state.appointments.map((a) =>
        a.id === id ? { ...a, status } : a
      )
      // Mock cross-entity flow: checking a patient in also adds them to the
      // queue. A real backend would do this atomically server-side.
      const appointment = appointments.find((a) => a.id === id)
      if (status === 'arrived' && appointment) {
        const queueEntry: QueueEntry = {
          id: `q-${Date.now()}`,
          appointmentId: appointment.id,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          appointmentTime: appointment.scheduledFor,
          checkedInAt: new Date().toISOString(),
          status: 'waiting',
        }
        return {
          appointments,
          queue: [...state.queue, queueEntry],
        }
      }
      return { appointments }
    }),

  addQueueEntry: ({
    appointmentId,
    patientName,
    doctorName,
    appointmentTime,
  }) =>
    set((state) => ({
      queue: [
        ...state.queue,
        {
          id: `q-${Date.now()}`,
          appointmentId,
          patientName,
          doctorName,
          appointmentTime,
          checkedInAt: new Date().toISOString(),
          status: 'waiting',
        },
      ],
    })),

  callNext: () =>
    set((state) => {
      const waiting = state.queue
        .filter((e) => e.status === 'waiting')
        .sort(
          (a, b) =>
            new Date(a.checkedInAt).getTime() -
            new Date(b.checkedInAt).getTime()
        )
      const next = waiting[0]
      if (!next) return state
      return {
        queue: state.queue.map((e) =>
          e.id === next.id
            ? {
                ...e,
                status: 'called' as QueueStatus,
                calledAt: new Date().toISOString(),
              }
            : e
        ),
      }
    }),

  startVisit: (id) =>
    set((state) => {
      const room = queueRooms[state.roomCursor % queueRooms.length]
      return {
        roomCursor: state.roomCursor + 1,
        queue: state.queue.map((e) =>
          e.id === id ? { ...e, status: 'in_room' as QueueStatus, room } : e
        ),
      }
    }),

  completeVisit: (id) =>
    set((state) => ({
      queue: state.queue.map((e) =>
        e.id === id ? { ...e, status: 'done' as QueueStatus } : e
      ),
    })),

  markLeft: (id) =>
    set((state) => ({
      queue: state.queue.map((e) =>
        e.id === id ? { ...e, status: 'left' as QueueStatus } : e
      ),
    })),

  addPatient: (input) => {
    const patient: Patient = { ...input, id: `pat-${Date.now()}` }
    set((state) => ({ patients: [patient, ...state.patients] }))
    return patient
  },

  addDoctor: (input) => {
    const doctor: Doctor = { ...input, id: `doc-${Date.now()}` }
    set((state) => ({ doctors: [...state.doctors, doctor] }))
    return doctor
  },

  setDoctorStatus: (id, status) =>
    set((state) => ({
      doctors: state.doctors.map((d) => (d.id === id ? { ...d, status } : d)),
    })),

  addStaff: (input) => {
    const member: Staff = { ...input, id: `stf-${Date.now()}` }
    set((state) => ({ staff: [...state.staff, member] }))
    return member
  },

  addRoom: (input) => {
    const room: Room = { ...input, id: `room-${Date.now()}` }
    set((state) => ({ rooms: [...state.rooms, room] }))
    return room
  },

  setRoomStatus: (id, status) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? { ...r, status } : r)),
    })),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
}))
