import {
  Bell,
  Calendar,
  DoorOpen,
  LayoutDashboard,
  Settings,
  Stethoscope,
  User,
  UserCog,
  Users,
} from 'lucide-react'
import { Logo } from '@/assets/logo'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Admin',
    email: 'admin@mediq.ng',
  },
  teams: [
    {
      name: 'MediQ',
      logo: Logo,
      plan: 'Queue Management',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/admin/dashboard',
          icon: LayoutDashboard,
        },
        {
          title: 'Appointments',
          url: '/admin/appointments',
          icon: Calendar,
        },
        {
          title: 'Queue',
          url: '/admin/queue',
          icon: Users,
        },
        {
          title: 'Patients',
          url: '/admin/patients',
          icon: User,
        },
      ],
    },
    {
      title: 'Management',
      items: [
        {
          title: 'Doctors',
          url: '/admin/doctors',
          icon: Stethoscope,
          roles: ['admin'],
        },
        {
          title: 'Staff',
          url: '/admin/staff',
          icon: UserCog,
          roles: ['admin'],
        },
        {
          title: 'Rooms',
          url: '/admin/rooms',
          icon: DoorOpen,
          roles: ['admin'],
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Notifications',
          url: '/admin/notifications',
          icon: Bell,
        },
        {
          title: 'Settings',
          icon: Settings,
          roles: ['admin'],
          items: [
            {
              title: 'Profile',
              url: '/admin/settings',
              icon: UserCog,
            },
            {
              title: 'Account',
              url: '/admin/settings/account',
            },
            {
              title: 'Appearance',
              url: '/admin/settings/appearance',
            },
            {
              title: 'Notifications',
              url: '/admin/settings/notifications',
            },
            {
              title: 'Display',
              url: '/admin/settings/display',
            },
            {
              title: 'Facility',
              url: '/admin/settings/facility',
            },
          ],
        },
      ],
    },
  ],
}
