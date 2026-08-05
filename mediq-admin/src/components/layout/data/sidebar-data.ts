import {
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
    avatar: '/avatars/shadcn.jpg',
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
        },
        {
          title: 'Staff',
          url: '/admin/staff',
          icon: UserCog,
        },
        {
          title: 'Rooms',
          url: '/admin/rooms',
          icon: DoorOpen,
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          icon: Settings,
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
          ],
        },
      ],
    },
  ],
}
