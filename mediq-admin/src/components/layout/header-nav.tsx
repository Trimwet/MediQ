import { TopNav } from '@/components/layout/top-nav'

export type HeaderNavKey = 'overview' | 'appointments' | 'queue'

const links: { title: string; href: string; key: HeaderNavKey }[] = [
  { title: 'Overview', href: '/admin/dashboard', key: 'overview' },
  { title: 'Appointments', href: '/admin/appointments', key: 'appointments' },
  { title: 'Queue', href: '/admin/queue', key: 'queue' },
]

/**
 * The section navigation shown in the page header. Every page renders the
 * same three links; the only difference is which one is active — so that
 * lives here instead of being copy-pasted into nine page files.
 */
export function HeaderNav({ active }: { active?: HeaderNavKey }) {
  return (
    <TopNav
      links={links.map(({ key, ...link }) => ({
        ...link,
        isActive: key === active,
        disabled: false,
      }))}
      className='me-auto'
    />
  )
}
