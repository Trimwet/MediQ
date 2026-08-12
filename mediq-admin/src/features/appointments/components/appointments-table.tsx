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
  onStatusChange: (id: string, status: AppointmentStatus) => void
}

export function AppointmentsTable({
  data,
  loading = false,
  canManage,
  onStatusChange,
}: AppointmentsTableProps) {
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
      },
      {
        accessorKey: 'scheduledFor',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Time' />
        ),
        cell: ({ row }) =>
          new Date(row.getValue('scheduledFor')).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ row }) => row.getValue('reason') ?? '—',
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
                  />
                </div>
              ),
            } satisfies ColumnDef<Appointment>,
          ]
        : []),
    ],
    [canManage, onStatusChange]
  )

  return (
    <SimpleDataTable
      columns={columns}
      data={data}
      loading={loading}
      searchPlaceholder='Search patients, doctors...'
      filters={[
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
