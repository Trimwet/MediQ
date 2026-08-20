import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hasRole } from '@/config/rbac'
import { useAuthStore } from '@/stores/auth-store'
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
  const { isDoctor, doctor } = useDoctorIdentity()
  return useQuery({
    queryKey: ['appointments', doctor?.id ?? (isDoctor ? 'unresolved' : 'all')],
    queryFn: async () => {
      const all = await appointmentsRepository.list()
      if (!isDoctor) return all
      if (!doctor) return []
      return all.filter((a) => a.doctorId === doctor.id)
    },
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

export function useCancelAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      appointmentsRepository.updateStatus(id, 'cancelled'),
    onSuccess: () => {
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
  const { isDoctor, doctor } = useDoctorIdentity()
  return useQuery({
    queryKey: ['queue', doctor?.id ?? (isDoctor ? 'unresolved' : 'all')],
    queryFn: async () => {
      const all = await queueRepository.list()
      if (!isDoctor) return all
      if (!doctor) return []
      // Prefer matching by appointmentId → doctor.id for accuracy.
      // Fall back to doctorName string match for queue entries without an
      // appointmentId (e.g. walk-ins added directly to the queue).
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
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['queue'] })

  const callNext = useMutation({
    // When a doctor clicks "Call next", scope it to their own queue so they
    // don't accidentally call another doctor's patient.
    mutationFn: () =>
      queueRepository.callNext(isDoctor ? doctor?.name : undefined),
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
  const { isDoctor, doctor } = useDoctorIdentity()
  return useQuery({
    queryKey: ['patients', doctor?.id ?? (isDoctor ? 'unresolved' : 'all')],
    queryFn: async () => {
      const [allPatients, allAppointments] = await Promise.all([
        patientsRepository.list(),
        appointmentsRepository.list(),
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

export function useDeleteDoctor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => doctorsRepository.delete(id),
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

export function useDeleteStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => staffRepository.delete(id),
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
