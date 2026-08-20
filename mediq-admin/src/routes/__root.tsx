import { type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createRootRouteWithContext, Outlet, useRouter } from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@/components/ui/sonner'
import { WavePhysicsLoader } from '@/components/wave-physics-loader'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'

import { useSupabaseAuthSync } from '@/hooks/use-supabase-auth-sync'
import { useRealtimeSync } from '@/hooks/use-realtime-sync'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => {
    useSupabaseAuthSync()
    useRealtimeSync()
    const router = useRouter()
    const userRole = useAuthStore((state) => state.auth.user?.role?.join(','))
    
    useEffect(() => {
      router.invalidate()
    }, [userRole, router])

    return (
      <>
        <Outlet />
        <Toaster duration={5000} />
        {import.meta.env.MODE === 'development' && (
          <>
            <ReactQueryDevtools buttonPosition='bottom-left' />
            <TanStackRouterDevtools position='bottom-right' />
          </>
        )}
      </>
    )
  },
  pendingComponent: () => (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/60">
      <WavePhysicsLoader size="lg" />
    </div>
  ),
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
