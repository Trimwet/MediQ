import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  CalendarPlus,
  ChevronRight,
  DoorOpen,
  Laptop,
  Moon,
  Sun,
  UserPlus,
} from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>No results found.</CommandEmpty>          {sidebarData.navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem, i) => {
                if (navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={`Navigate to ${navItem.title}`}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                    >
                      {navItem.icon && (
                        <navItem.icon className='size-4 text-muted-foreground' />
                      )}
                      {!navItem.icon && (
                        <ArrowRight className='size-3 text-muted-foreground/60' />
                      )}
                      {navItem.title}
                    </CommandItem>
                  )

                return navItem.items?.map((subItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${i}`}
                    value={`Navigate to ${navItem.title} ${subItem.title}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }))
                    }}
                  >
                    <ChevronRight className='size-3 text-muted-foreground/60' />
                    {navItem.title} <ChevronRight /> {subItem.title}
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading='Quick Actions'>
            <CommandItem
              value='Book appointment'
              onSelect={() =>
                runCommand(() => navigate({ to: '/admin/appointments' }))
              }
            >
              <CalendarPlus className='size-4 text-muted-foreground' />
              <span>Book appointment</span>
            </CommandItem>
            <CommandItem
              value='Add patient'
              onSelect={() =>
                runCommand(() => navigate({ to: '/admin/patients' }))
              }
            >
              <UserPlus className='size-4 text-muted-foreground' />
              <span>Add patient</span>
            </CommandItem>
            <CommandItem
              value='Manage rooms'
              onSelect={() =>
                runCommand(() => navigate({ to: '/admin/rooms' }))
              }
            >
              <DoorOpen className='size-4 text-muted-foreground' />
              <span>Manage rooms</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading='Theme'>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>Light</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>Dark</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
