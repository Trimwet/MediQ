import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Footer } from '@/features/landing/components/Footer'
import { NavBar } from '@/features/landing/components/NavBar'

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
    </div>
  )
}
