import { Outlet } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { ClinicProvider, useClinicContext } from '@/lib/clinic-context'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import { Button } from '@/components/ui/button'

function NoClinicError() {
  const { error } = useClinicContext()
  if (!error) return null

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center'>
      <p className='text-lg font-semibold text-muted-foreground'>{error}</p>
      <Button
        variant='outline'
        onClick={() => {
          // Sign out and redirect to sign-in
          window.location.href = '/sign-in'
        }}
      >
        <LogOut />
        Sign out
      </Button>
    </div>
  )
}

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  return (
    <ClinicProvider>
      <NoClinicError />
      <AuthenticatedLayoutInner defaultOpen={defaultOpen} children={children} />
    </ClinicProvider>
  )
}

function AuthenticatedLayoutInner({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean
  children?: React.ReactNode
}) {
  const { error } = useClinicContext()
  // When there's a no-clinic error, NoClinicError already renders above.
  // Hide the sidebar/content so they don't flash behind the error screen.
  if (error) return null

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar />
          <SidebarInset
            className={cn(
              '@container/content',
              'has-data-[layout=fixed]:h-svh',
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
