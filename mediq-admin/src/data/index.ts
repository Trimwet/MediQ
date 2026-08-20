/**
 * Data layer entry point.
 *
 * Pages and hooks import repositories from here — never from the
 * implementations directly. The Supabase implementations match the same
 * interfaces as the mock repos; swapping back to mock is a one-line change.
 */
export {
  appointmentsRepository,
  authRepository,
  bookingRepository,
  doctorsRepository,
  notificationsRepository,
  patientsRepository,
  queueRepository,
  roomsRepository,
  staffRepository,
} from './supabase/repos'
export type {
  AppointmentsRepository,
  AuthRepository,
  BookingInput,
  BookingRepository,
  BookingResult,
  DoctorsRepository,
  NotificationsRepository,
  PatientsRepository,
  QueueRepository,
  RoomsRepository,
  SignUpInput,
  StaffRepository,
} from './repos'
