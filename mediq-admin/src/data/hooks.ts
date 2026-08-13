import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type Appointment,
  type AppointmentStatus,
} from '@/features/appointments/schema'
import { type Doctor, type DoctorStatus } from '@/features/doctors/schema'
import { type Patient } from '@/features/patients/schema'
import { type Room, type RoomStatus } from '@/features/rooms/schema'
import { type Staff } from '@/features/staff/schema'
import {
  appointmentsRepository,
  bookingRepository,
  doctorsRepository,
  notificationsRepository,
  patientsRepository,
  queueRepository,
  roomsRepository,
  staffRepository,
} from './index'
import { type BookingInput } from './index'

// ---- Appointments ----

export function useAppointments() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: () => appointmentsRepository.list(),
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Appointment, 'id' | 'status'>) =>
      appointmentsRepository.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  })
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentsRepository.updateStatus(id, status),
    // Check-in also affects the queue (see mock store).
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
  })
}

export function useApproveAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      doctor,
    }: {
      id: string
      doctor?: { id: string; name: string }
    }) => appointmentsRepository.approve(id, doctor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useRejectAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      appointmentsRepository.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// ---- Self-service booking ----

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
  return useQuery({
    queryKey: ['queue'],
    queryFn: () => queueRepository.list(),
  })
}

export function useQueueActions() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['queue'] })

  const callNext = useMutation({
    mutationFn: () => queueRepository.callNext(),
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
  return useQuery({
    queryKey: ['patients'],
    queryFn: () => patientsRepository.list(),
  })
}

export function useCreatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Patient, 'id'>) =>
      patientsRepository.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  })
}

// ---- Doctors ----

export function useDoctors() {
  return useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsRepository.list(),
  })
}

export function useCreateDoctor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Doctor, 'id'>) => doctorsRepository.create(input),
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

// ---- Staff ----

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: () => staffRepository.list(),
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Staff, 'id'>) => staffRepository.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })
}

// ---- Rooms ----

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsRepository.list(),
  })
}

export function useCreateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Room, 'id'>) => roomsRepository.create(input),
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
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsRepository.list(),
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
