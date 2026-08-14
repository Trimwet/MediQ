/**
 * Mock dataset — the single source of truth while there is no backend.
 *
 * The repositories in `src/data/repos.ts` serve these through a shared
 * in-memory store. When the API exists, this file goes away and the repos
 * talk to axios instead; pages never import from here directly.
 */
import { type Appointment } from '@/features/appointments/schema'
import { type Doctor } from '@/features/doctors/schema'
import { type AppNotification } from '@/features/notifications/schema'
import { type Patient } from '@/features/patients/schema'
import { type QueueEntry } from '@/features/queue/schema'
import { type Room } from '@/features/rooms/schema'
import { type Staff } from '@/features/staff/schema'

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString()
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function at(hour: number, minute = 0): string {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString()
}

export const seedAppointments: Appointment[] = [
  {
    id: 'apt-01',
    patientName: 'Aisha Bello',
    doctorId: 'doc-01',
    doctorName: 'Dr. Adebayo',
    scheduledFor: at(9, 0),
    status: 'completed',
    reason: 'Chest pain follow-up',
  },
  {
    id: 'apt-02',
    patientName: 'Chinedu Okonkwo',
    doctorId: 'doc-02',
    doctorName: 'Dr. Okafor',
    scheduledFor: at(9, 30),
    status: 'completed',
    reason: 'Child vaccination',
  },
  {
    id: 'apt-03',
    patientName: 'Fatima Yusuf',
    doctorId: 'doc-03',
    doctorName: 'Dr. Eze',
    scheduledFor: at(10, 0),
    status: 'arrived',
    reason: 'Routine check-up',
  },
  {
    id: 'apt-04',
    patientName: 'Emeka Nwosu',
    doctorId: 'doc-01',
    doctorName: 'Dr. Adebayo',
    scheduledFor: at(10, 30),
    status: 'booked',
    reason: 'Blood pressure review',
  },
  {
    id: 'apt-05',
    patientName: 'Ngozi Umeh',
    doctorId: 'doc-04',
    doctorName: 'Dr. Balogun',
    scheduledFor: at(11, 0),
    status: 'booked',
    reason: 'Skin rash',
  },
  {
    id: 'apt-06',
    patientName: 'Tunde Ojo',
    doctorId: 'doc-02',
    doctorName: 'Dr. Okafor',
    scheduledFor: at(11, 30),
    status: 'in_progress',
    reason: 'Fever consultation',
  },
  {
    id: 'apt-07',
    patientName: 'Halima Abubakar',
    doctorId: 'doc-03',
    doctorName: 'Dr. Eze',
    scheduledFor: at(12, 0),
    status: 'booked',
    reason: 'Diabetes check',
  },
  {
    id: 'apt-08',
    patientName: 'Segun Alabi',
    doctorId: 'doc-01',
    doctorName: 'Dr. Adebayo',
    scheduledFor: at(13, 0),
    status: 'booked',
    reason: 'ECG review',
  },
  {
    id: 'apt-09',
    patientName: 'Zainab Ibrahim',
    doctorId: 'doc-04',
    doctorName: 'Dr. Balogun',
    scheduledFor: at(13, 30),
    status: 'no_show',
    reason: 'Acne treatment',
  },
  {
    id: 'apt-10',
    patientName: 'Kelechi Obi',
    doctorId: 'doc-03',
    doctorName: 'Dr. Eze',
    scheduledFor: at(14, 0),
    status: 'booked',
    reason: 'Malaria test results',
  },
  {
    id: 'apt-11',
    patientName: 'Amara Nwachukwu',
    doctorId: 'doc-02',
    doctorName: 'Dr. Okafor',
    scheduledFor: at(14, 30),
    status: 'cancelled',
    reason: 'Hearing test',
  },
  {
    id: 'apt-12',
    patientName: 'Ibrahim Musa',
    doctorId: 'doc-01',
    doctorName: 'Dr. Adebayo',
    scheduledFor: at(15, 0),
    status: 'booked',
    reason: 'Hypertension follow-up',
  },
  {
    id: 'apt-13',
    patientName: 'Oluwaseun Adeyemi',
    doctorId: 'doc-04',
    doctorName: 'Dr. Balogun',
    scheduledFor: at(15, 30),
    status: 'booked',
    reason: 'Eczema review',
  },
  {
    id: 'apt-14',
    patientName: 'Chioma Okafor',
    doctorId: 'doc-03',
    doctorName: 'Dr. Eze',
    scheduledFor: at(16, 0),
    status: 'booked',
    reason: 'Prenatal check',
  },
]

export const seedQueue: QueueEntry[] = [
  {
    id: 'q-01',
    patientName: 'Aisha Bello',
    appointmentTime: minutesAgo(18),
    checkedInAt: minutesAgo(16),
    calledAt: minutesAgo(9),
    doctorName: 'Dr. Adebayo',
    room: '2',
    status: 'in_room',
  },
  {
    id: 'q-02',
    patientName: 'Chinedu Okonkwo',
    appointmentTime: minutesAgo(22),
    checkedInAt: minutesAgo(19),
    calledAt: minutesAgo(11),
    doctorName: 'Dr. Okafor',
    status: 'called',
  },
  {
    id: 'q-03',
    patientName: 'Fatima Yusuf',
    appointmentTime: minutesAgo(25),
    checkedInAt: minutesAgo(24),
    doctorName: 'Dr. Eze',
    status: 'waiting',
  },
  {
    id: 'q-04',
    patientName: 'Emeka Nwosu',
    appointmentTime: minutesAgo(30),
    checkedInAt: minutesAgo(28),
    doctorName: 'Dr. Adebayo',
    status: 'waiting',
  },
  {
    id: 'q-05',
    patientName: 'Ngozi Umeh',
    appointmentTime: minutesAgo(33),
    checkedInAt: minutesAgo(31),
    doctorName: 'Dr. Balogun',
    status: 'waiting',
  },
  {
    id: 'q-06',
    patientName: 'Tunde Ojo',
    appointmentTime: minutesAgo(38),
    checkedInAt: minutesAgo(36),
    doctorName: 'Dr. Okafor',
    status: 'waiting',
  },
  {
    id: 'q-07',
    patientName: 'Halima Abubakar',
    appointmentTime: minutesAgo(42),
    checkedInAt: minutesAgo(40),
    doctorName: 'Dr. Eze',
    status: 'waiting',
  },
  {
    id: 'q-08',
    patientName: 'Segun Alabi',
    appointmentTime: minutesAgo(46),
    checkedInAt: minutesAgo(45),
    doctorName: 'Dr. Adebayo',
    status: 'waiting',
  },
  {
    id: 'q-09',
    patientName: 'Zainab Ibrahim',
    appointmentTime: minutesAgo(52),
    checkedInAt: minutesAgo(50),
    doctorName: 'Dr. Balogun',
    status: 'waiting',
  },
]

export const seedPatients: Patient[] = [
  {
    id: 'pat-01',
    name: 'Aisha Bello',
    phone: '+234 801 234 5678',
    email: 'aisha.bello@example.com',
    lastVisit: daysAgo(4),
    visits: 6,
  },
  {
    id: 'pat-02',
    name: 'Chinedu Okonkwo',
    phone: '+234 802 345 6789',
    email: 'chinedu.o@example.com',
    lastVisit: daysAgo(12),
    visits: 3,
  },
  {
    id: 'pat-03',
    name: 'Fatima Yusuf',
    phone: '+234 803 456 7890',
    lastVisit: daysAgo(1),
    visits: 9,
  },
  {
    id: 'pat-04',
    name: 'Emeka Nwosu',
    phone: '+234 804 567 8901',
    email: 'emeka.nwosu@example.com',
    lastVisit: daysAgo(21),
    visits: 2,
  },
  {
    id: 'pat-05',
    name: 'Ngozi Umeh',
    phone: '+234 805 678 9012',
    email: 'ngozi.umeh@example.com',
    lastVisit: daysAgo(7),
    visits: 4,
  },
  {
    id: 'pat-06',
    name: 'Tunde Ojo',
    phone: '+234 806 789 0123',
    lastVisit: daysAgo(35),
    visits: 1,
  },
  {
    id: 'pat-07',
    name: 'Halima Abubakar',
    phone: '+234 807 890 1234',
    email: 'halima.a@example.com',
    lastVisit: daysAgo(2),
    visits: 11,
  },
  {
    id: 'pat-08',
    name: 'Segun Alabi',
    phone: '+234 808 901 2345',
    email: 'segun.alabi@example.com',
    lastVisit: daysAgo(14),
    visits: 5,
  },
  {
    id: 'pat-09',
    name: 'Zainab Ibrahim',
    phone: '+234 809 012 3456',
    lastVisit: daysAgo(9),
    visits: 3,
  },
  {
    id: 'pat-10',
    name: 'Kelechi Obi',
    phone: '+234 810 123 4567',
    email: 'kelechi.obi@example.com',
    lastVisit: daysAgo(28),
    visits: 2,
  },
  {
    id: 'pat-11',
    name: 'Amara Nwachukwu',
    phone: '+234 811 234 5678',
    email: 'amara.n@example.com',
    lastVisit: daysAgo(3),
    visits: 7,
  },
  {
    id: 'pat-12',
    name: 'Ibrahim Musa',
    phone: '+234 812 345 6789',
    lastVisit: daysAgo(16),
    visits: 4,
  },
  {
    id: 'pat-13',
    name: 'Oluwaseun Adeyemi',
    phone: '+234 813 456 7890',
    email: 'oluwaseun.a@example.com',
    lastVisit: daysAgo(6),
    visits: 2,
  },
  {
    id: 'pat-14',
    name: 'Chioma Okafor',
    phone: '+234 814 567 8901',
    email: 'chioma.o@example.com',
    lastVisit: daysAgo(40),
    visits: 1,
  },
]

export const seedDoctors: Doctor[] = [
  {
    id: 'doc-01',
    name: 'Dr. Adebayo',
    specialization: 'Cardiology',
    email: 'dr.adebayo@mediq.ng',
    status: 'active',
    todayAppointments: 5,
  },
  {
    id: 'doc-02',
    name: 'Dr. Okafor',
    specialization: 'Pediatrics',
    email: 'dr.okafor@mediq.ng',
    status: 'active',
    todayAppointments: 4,
  },
  {
    id: 'doc-03',
    name: 'Dr. Eze',
    specialization: 'General Practice',
    email: 'dr.eze@mediq.ng',
    status: 'active',
    todayAppointments: 6,
  },
  {
    id: 'doc-04',
    name: 'Dr. Balogun',
    specialization: 'Dermatology',
    email: 'dr.balogun@mediq.ng',
    status: 'away',
    todayAppointments: 2,
  },
  {
    id: 'doc-05',
    name: 'Dr. Nwankwo',
    specialization: 'Neurology',
    email: 'dr.nwankwo@mediq.ng',
    status: 'active',
    todayAppointments: 3,
  },
  {
    id: 'doc-06',
    name: 'Dr. Oyelaran',
    specialization: 'Orthopedics',
    email: 'dr.oyelaran@mediq.ng',
    status: 'active',
    todayAppointments: 4,
  },
]

export const seedStaff: Staff[] = [
  {
    id: 'stf-01',
    name: 'Blessing Adeyemi',
    role: 'front_desk',
    phone: '+234 801 111 2233',
    email: 'blessing.a@mediq.ng',
    status: 'active',
  },
  {
    id: 'stf-02',
    name: 'Samuel Ogunleye',
    role: 'front_desk',
    phone: '+234 802 222 3344',
    email: 'samuel.o@mediq.ng',
    status: 'active',
  },
  {
    id: 'stf-03',
    name: 'Mary Okafor',
    role: 'admin',
    phone: '+234 803 333 4455',
    email: 'mary.o@mediq.ng',
    status: 'active',
  },
  {
    id: 'stf-04',
    name: 'Daniel Ekwueme',
    role: 'front_desk',
    phone: '+234 804 444 5566',
    email: 'daniel.e@mediq.ng',
    status: 'inactive',
  },
  {
    id: 'stf-05',
    name: 'Grace Adamu',
    role: 'front_desk',
    phone: '+234 805 555 6677',
    email: 'grace.a@mediq.ng',
    status: 'active',
  },
]

export const seedNotifications: AppNotification[] = [
  {
    id: 'ntf-01',
    type: 'queue',
    channel: 'push',
    title: 'Patient called',
    message: 'Chinedu Okonkwo has been called for Dr. Okafor.',
    createdAt: hoursAgo(0.2),
    read: false,
  },
  {
    id: 'ntf-02',
    type: 'appointment',
    channel: 'email',
    title: 'Appointment reminder',
    message:
      "Aisha Bello's chest pain follow-up with Dr. Adebayo is tomorrow at 9:00 AM.",
    createdAt: hoursAgo(2),
    read: false,
  },
  {
    id: 'ntf-03',
    type: 'queue',
    channel: 'sms',
    title: 'Queue update',
    message: "Fatima Yusuf's wait time is now under 15 minutes.",
    createdAt: hoursAgo(3.5),
    read: false,
  },
  {
    id: 'ntf-04',
    type: 'system',
    channel: 'in_app',
    title: 'Daily report ready',
    message: "Today's appointments and queue summary is ready to review.",
    createdAt: hoursAgo(6),
    read: true,
  },
  {
    id: 'ntf-05',
    type: 'summary',
    channel: 'email',
    title: 'Yesterday at a glance',
    message: '14 appointments scheduled, 11 completed, 2 no-shows.',
    createdAt: hoursAgo(20),
    read: true,
  },
  {
    id: 'ntf-06',
    type: 'appointment',
    channel: 'sms',
    title: 'Appointment confirmed',
    message:
      "Emeka Nwosu's blood pressure review with Dr. Adebayo is confirmed for today at 10:30 AM.",
    createdAt: hoursAgo(26),
    read: true,
  },
]

export const seedRooms: Room[] = [
  { id: 'room-01', number: '1', type: 'consultation', status: 'available' },
  {
    id: 'room-02',
    number: '2',
    type: 'consultation',
    status: 'occupied',
    doctorName: 'Dr. Adebayo',
    patientName: 'Aisha Bello',
  },
  { id: 'room-03', number: '3', type: 'procedure', status: 'cleaning' },
  { id: 'room-04', number: '4', type: 'consultation', status: 'available' },
  {
    id: 'room-05',
    number: '5',
    type: 'recovery',
    status: 'occupied',
    doctorName: 'Dr. Okafor',
    patientName: 'Tunde Ojo',
  },
  { id: 'room-06', number: '6', type: 'consultation', status: 'available' },
  {
    id: 'room-07',
    number: '7',
    type: 'procedure',
    status: 'occupied',
    doctorName: 'Dr. Eze',
    patientName: 'Chioma Okafor',
  },
  { id: 'room-08', number: '8', type: 'recovery', status: 'cleaning' },
]
