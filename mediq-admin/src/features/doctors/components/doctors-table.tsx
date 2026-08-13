import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTableColumnHeader } from '@/components/data-table'
import { SimpleDataTable } from '@/components/data-table/simple-table'
import {
  doctorStatusBadge,
  doctorStatuses,
  type Doctor,
  type DoctorStatus,
} from '../schema'

type DoctorsTableProps = {
  data: Doctor[]
  loading?: boolean
  canManage: boolean
  onStatusChange: (id: string, status: DoctorStatus) => void
}

export function DoctorsTable({
  data,
  loading = false,
  canManage,
  onStatusChange,
}: DoctorsTableProps) {
  const columns = useMemo<ColumnDef<Doctor>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Doctor' />
        ),
        cell: ({ row }) => (
          <div>
            <p className='font-medium'>{row.getValue('name')}</p>
            <p className='text-xs text-muted-foreground'>
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'specialization',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Specialization' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {row.getValue('specialization')}
          </span>
        ),
      },
      {
        accessorKey: 'todayAppointments',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Today' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {row.getValue<number>('todayAppointments')} appointments
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => {
          const status = row.getValue<DoctorStatus>('status')
          return (
            <Badge variant='outline' className={doctorStatusBadge[status]}>
              {status}
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
              cell: ({ row }: { row: { original: Doctor } }) => (
                <DoctorRowActions
                  doctor={row.original}
                  onStatusChange={onStatusChange}
                />
              ),
            } satisfies ColumnDef<Doctor>,
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
      searchPlaceholder='Search doctors...'
      emptyMessage='No doctors found.'
      emptyDescription='Add a doctor to get started with scheduling.'
      filters={[
        {
          columnId: 'status',
          title: 'Status',
          options: doctorStatuses.map((status) => ({
            label: status,
            value: status,
          })),
        },
      ]}
    />
  )
}

type DoctorRowActionsProps = {
  doctor: Doctor
  onStatusChange: (id: string, status: DoctorStatus) => void
}

function DoctorRowActions({
  doctor,
  onStatusChange,
}: DoctorRowActionsProps) {
  const toggle: DoctorStatus = doctor.status === 'active' ? 'away' : 'active'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='size-8 p-0'>
          <span className='sr-only'>Open menu</span>
          <MoreHorizontal className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-40'>
        <DropdownMenuLabel className='text-xs text-muted-foreground'>
          Availability
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onStatusChange(doctor.id, toggle)}>
          {toggle === 'active' ? 'Mark active' : 'Mark away'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onStatusChange(doctor.id, 'away')}
          disabled={doctor.status === 'away'}
        >
          Mark away
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
