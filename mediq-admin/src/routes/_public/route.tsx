import { createFileRoute, Outlet } from '@tanstack/react-router'
import { NavBar } from '@/features/landing/components/NavBar'
import { Footer } from '@/features/landing/components/Footer'
import { EmergencyBanner } from '@/features/landing/components/EmergencyBanner'

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <div className='flex min-h-svh flex-col bg-background text-foreground'>
      <NavBar />
      <main className='flex-1'>
        <Outlet />
      </main>
      <Footer />
      <EmergencyBanner />
    </div>
  )
}
