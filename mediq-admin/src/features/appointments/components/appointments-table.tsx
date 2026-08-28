import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { SimpleDataTable } from '@/components/data-table/simple-table'
import {
  appointmentStatusBadge,
  appointmentStatuses,
  type Appointment,
  type AppointmentStatus,
} from '../schema'
import { AppointmentRowActions } from './appointment-row-actions'

type AppointmentsTableProps = {
  data: Appointment[]
  loading?: boolean
  canManage: boolean
  /** Disable all row actions while a mutation is in-flight. */
  isActionsDisabled?: boolean
  onStatusChange: (id: string, status: AppointmentStatus) => void
  onApprove: (appointment: Appointment) => void
  onReject: (appointment: Appointment) => void
}

export function AppointmentsTable({
  data,
  loading = false,
  canManage,
  isActionsDisabled = false,
  onStatusChange,
  onApprove,
  onReject,
}: AppointmentsTableProps) {
  const doctorFilterOptions = useMemo(() => {
    const unique = Array.from(new Set(data.map((d) => d.doctorName))).sort()
    return unique.map((name) => ({ label: name, value: name }))
  }, [data])

  const columns = useMemo<ColumnDef<Appointment>[]>(
    () => [
      {
        accessorKey: 'patientName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Patient' />
        ),
        cell: ({ row }) => (
          <span className='font-medium'>{row.getValue('patientName')}</span>
        ),
      },
      {
        accessorKey: 'doctorName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Doctor' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {row.getValue('doctorName')}
          </span>
        ),
        filterFn: (row, id, value) =>
          (value as string[]).includes(row.getValue(id) as string),
      },
      {
        accessorKey: 'scheduledFor',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Date • Time' />
        ),
        cell: ({ row }) => {
          const d = new Date(row.getValue('scheduledFor'))
          return (
            <span className='whitespace-nowrap'>
              {d.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
              })}
              {' · '}
              {d.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )
        },
        sortingFn: 'datetime',
        filterFn: (row, id, value) => {
          const iso = row.getValue<string>(id)
          const d = new Date(iso)
          const now = new Date()
          const startToday = new Date(now)
          startToday.setHours(0, 0, 0, 0)
          const endToday = new Date(now)
          endToday.setHours(23, 59, 59, 999)
          return (value as string[]).some((v) => {
            if (v === 'today')
              return d >= startToday && d <= endToday
            if (v === 'past') return d < startToday
            if (v === 'upcoming') return d > endToday
            if (v === 'recent') {
              const diff = (d.getTime() - now.getTime()) / 86_400_000
              return diff >= -7 && diff <= 7
            }
            if (v === 'week') {
              const weekFromNow = new Date(now.getTime() + 7 * 86_400_000)
              return d > endToday && d <= weekFromNow
            }
            return false
          })
        },
      },
      {
        accessorKey: 'reason',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Reason' />
        ),
        cell: ({ row }) => {
          const v = row.getValue<string | undefined>('reason')
          return v ? (
            <span className='text-muted-foreground'>{v}</span>
          ) : (
            <span className='text-muted-foreground'>—</span>
          )
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => {
          const status = row.getValue<AppointmentStatus>('status')
          return (
            <Badge
              variant='outline'
              className={appointmentStatusBadge[status]}
            >
              {status.replace('_', ' ')}
            </Badge>
          )
        },
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
        sortingFn: (rowA, rowB, columnId) => {
          const order: Record<AppointmentStatus, number> = {
            pending: 0,
            booked: 1,
            arrived: 2,
            in_progress: 3,
            completed: 4,
            no_show: 5,
            cancelled: 6,
            rejected: 7,
          }
          const a = rowA.getValue<AppointmentStatus>(columnId)
          const b = rowB.getValue<AppointmentStatus>(columnId)
          return (order[a] ?? 99) - (order[b] ?? 99)
        },
      },
      ...(canManage
        ? [
            {
              id: 'actions',
              header: () => <span className='sr-only'>Actions</span>,
              cell: ({ row }: { row: { original: Appointment } }) => (
                <div className='text-end'>
                  <AppointmentRowActions
                    appointment={row.original}
                    onStatusChange={onStatusChange}
                    onApprove={onApprove}
                    onReject={onReject}
                    disabled={isActionsDisabled}
                  />
                </div>
              ),
            } satisfies ColumnDef<Appointment>,
          ]
        : []),
    ],
    [canManage, isActionsDisabled, onStatusChange, onApprove, onReject]
  )

  return (
    <SimpleDataTable
      columns={columns}
      data={data}
      loading={loading}
      searchPlaceholder='Search patients, doctors...'
      emptyMessage='No appointments scheduled.'
      emptyDescription='Book an appointment to get started.'
      // Pending booking requests first, then most recent scheduled time.
      // This puts new bookings (pending) at the very top so staff see recent requests immediately.
      initialSorting={[
        { id: 'status', desc: false },
        { id: 'scheduledFor', desc: true },
      ]}
      filters={[
        {
          columnId: 'scheduledFor',
          title: 'Date',
          options: [
            { label: 'Recent (7d)', value: 'recent' },
            { label: 'Today', value: 'today' },
            { label: 'Next 7 days', value: 'week' },
            { label: 'Upcoming', value: 'upcoming' },
            { label: 'Past', value: 'past' },
          ],
        },
        ...(doctorFilterOptions.length
          ? [
              {
                columnId: 'doctorName',
                title: 'Doctor',
                options: doctorFilterOptions,
              },
            ]
          : []),
        {
          columnId: 'status',
          title: 'Status',
          options: appointmentStatuses.map((status) => ({
            label: status.replace('_', ' '),
            value: status,
          })),
        },
      ]}
    />
  )
}
