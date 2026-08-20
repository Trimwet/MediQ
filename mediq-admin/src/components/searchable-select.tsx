import { useState } from 'react'
import { Check, ChevronDown, ChevronsUpDown, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type SelectOption = { label: string; value: string }

type SearchableSelectProps = {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  isPending?: boolean
  disabled?: boolean
  /** Flat options (rendered in a single list). */
  items?: SelectOption[]
  /**
   * Grouped options — each group renders a collapsible header (name, count,
   * chevron). Groups start collapsed and expand on click; searching expands
   * everything that matches.
   */
  groups?: { heading?: string; count?: number; items: SelectOption[] }[]
  className?: string
}

/**
 * A select that lets users type to filter the options (shadcn combobox
 * pattern). Long option lists can be passed grouped (e.g. doctors by
 * specialty); groups are collapsed by default and expand on click so the
 * list stays scannable without typing.
 */
export function SearchableSelect({
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No matches found.',
  isPending = false,
  disabled = false,
  items,
  groups,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const query = search.trim().toLowerCase()
  const isSearching = query.length > 0
  const matches = (label: string) =>
    !isSearching || label.toLowerCase().includes(query)

  const flat = groups ? groups.flatMap((g) => g.items) : (items ?? [])
  const selected = flat.find((item) => item.value === value)

  const visibleGroups = groups
    ? groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => matches(item.label)),
        }))
        .filter((group) => group.items.length > 0)
    : undefined
  const visibleItems = groups ? undefined : flat.filter((item) => matches(item.label))

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function renderItem(item: SelectOption) {
    return (
      <CommandItem
        key={item.value}
        value={item.value}
        onSelect={(currentValue) => {
          onValueChange?.(currentValue)
          setOpen(false)
        }}
      >
        <Check
          className={cn(
            'size-4',
            value === item.value ? 'opacity-100' : 'opacity-0'
          )}
        />
        {item.label}
      </CommandItem>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setSearch('')
          setExpanded(new Set())
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled || isPending}
          className={cn(
            'h-9 w-full justify-between px-3 font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          {isPending ? (
            <span className='flex items-center gap-2'>
              <Loader className='size-4 animate-spin' />
              Loading...
            </span>
          ) : selected ? (
            selected.label
          ) : (
            placeholder
          )}
          <ChevronsUpDown className='size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-(--radix-popover-trigger-width) min-w-56 p-0'
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            className='h-9'
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {visibleGroups ? (
              visibleGroups.map((group, index) => {
                const key = group.heading ?? `group-${index}`
                const hasHeading = Boolean(group.heading)
                const isExpanded =
                  !hasHeading || isSearching || expanded.has(key)
                return (
                  <div key={key} data-slot='select-group'>
                    {hasHeading && (
                      <button
                        type='button'
                        aria-expanded={isExpanded}
                        onClick={() => toggleGroup(key)}
                        className='flex w-full cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors select-none hover:text-foreground'
                      >
                        <span className='truncate'>{group.heading}</span>
                        <span className='flex shrink-0 items-center gap-1.5'>
                          {group.count != null && (
                            <span className='rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground'>
                              {group.count}
                            </span>
                          )}
                          <ChevronDown
                            className={cn(
                              'size-3.5 transition-transform',
                              isExpanded && 'rotate-180'
                            )}
                          />
                        </span>
                      </button>
                    )}
                    {isExpanded && group.items.map(renderItem)}
                  </div>
                )
              })
            ) : (
              <CommandGroup>{(visibleItems ?? []).map(renderItem)}</CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
