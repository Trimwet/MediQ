/**
 * Domain data model contract for MediQ.
 *
 * There is no backend yet; these types define the shape the API must return so
 * that RBAC can be enforced at the data layer, not just in the UI.
 *
 * Row-level scoping rules for the future backend:
 * - `admin`     can read/write every row in the clinic.
 * - `front_desk` can read/write appointments, the queue, and patient contact
 *   details, but never clinical notes (`Appointment.notes` stays out of their
 *   API responses unless explicitly granted).
 * - `doctor`    can only read/write rows where `doctorId` matches their own
 *   account. List endpoints MUST filter server-side; never return all rows and
 *   filter in the client.
 *
 * The frontend never trusts these rules as security. The backend is the
 * enforcement point.
 */

export type AppointmentStatus =
  | 'booked'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled'

export type Appointment = {
  id: string
  patientId: string
  doctorId: string
  clinicId: string
  scheduledFor: string // ISO 8601
  status: AppointmentStatus
  bookedById: string // staff account that created it
  notes?: string // clinical notes: admin + doctor only
  createdAt: string
}

export type Patient = {
  id: string
  clinicId: string
  name: string
  phone: string
  email?: string
  createdAt: string
}

export type Doctor = {
  id: string
  clinicId: string
  name: string
  specialization: string
  active: boolean
}

export type QueueEntry = {
  id: string
  appointmentId: string
  clinicId: string
  checkedInAt: string
  calledAt?: string
  status: 'waiting' | 'called' | 'in_room' | 'done' | 'left'
}
