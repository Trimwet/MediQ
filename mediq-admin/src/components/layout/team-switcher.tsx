import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { useClinicContext } from '@/lib/clinic-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const { clinic, allClinics, switchClinic } = useClinicContext()

  if (!clinic) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex size-8 items-center justify-center rounded-md bg-primary/10'>
                <Building2 className='size-4 text-primary' />
              </div>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {clinic.clinicName}
                </span>
                <span className='truncate text-xs text-muted-foreground capitalize'>
                  {clinic.plan} plan
                </span>
              </div>
              {allClinics.length > 1 && (
                <ChevronsUpDown className='ms-auto size-4' />
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {allClinics.length > 1 && (
            <DropdownMenuContent
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
              align='start'
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
            >
              <DropdownMenuLabel className='text-xs text-muted-foreground'>
                Clinics
              </DropdownMenuLabel>
              {allClinics.map((c) => (
                <DropdownMenuItem
                  key={c.clinicId}
                  onClick={() => switchClinic(c.clinicId)}
                  className='gap-2 p-2'
                >
                  <div className='flex size-6 items-center justify-center rounded-md bg-primary/10'>
                    <Building2 className='size-3.5 text-primary' />
                  </div>
                  <div className='flex flex-col'>
                    <span className='font-medium'>{c.clinicName}</span>
                    <span className='text-xs text-muted-foreground capitalize'>
                      {c.clinicRole.replace('_', ' ')}
                    </span>
                  </div>
                  {c.clinicId === clinic.clinicId && (
                    <Check className='ms-auto size-4' />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
