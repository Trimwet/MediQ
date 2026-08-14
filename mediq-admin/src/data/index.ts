/**
 * Data layer entry point.
 *
 * Pages and hooks import repositories from here — never from the mock
 * implementations. To move to a real backend, implement the same interfaces
 * with axios in `src/data/api/` and swap the exports below; the UI and the
 * react-query hooks in `src/data/hooks.ts` stay unchanged.
 */
export {
  appointmentsRepository,
  bookingRepository,
  doctorsRepository,
  notificationsRepository,
  patientsRepository,
  queueRepository,
  roomsRepository,
  staffRepository,
} from './repos'
export type {
  AppointmentsRepository,
  BookingInput,
  BookingRepository,
  BookingResult,
  DoctorsRepository,
  NotificationsRepository,
  PatientsRepository,
  QueueRepository,
  RoomsRepository,
  StaffRepository,
} from './repos'
