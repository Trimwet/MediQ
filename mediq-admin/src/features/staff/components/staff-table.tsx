import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { SimpleDataTable } from '@/components/data-table/simple-table'
import {
  staffRoleBadge,
  staffRoles,
  staffStatusBadge,
  staffStatuses,
  type Staff,
  type StaffRole,
  type StaffStatus,
} from '../schema'

type StaffTableProps = {
  data: Staff[]
  loading?: boolean
  onDelete?: (id: string) => void
}

export function StaffTable({ data, loading = false, onDelete }: StaffTableProps) {
  const columns = useMemo<ColumnDef<Staff>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Name' />
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
        accessorKey: 'role',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Role' />
        ),
        cell: ({ row }) => {
          const role = row.getValue<StaffRole>('role')
          return (
            <Badge variant='outline' className={staffRoleBadge[role]}>
              {role.replace('_', ' ')}
            </Badge>
          )
        },
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => (
          <span className='text-muted-foreground'>{row.getValue('phone')}</span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => {
          const status = row.getValue<StaffStatus>('status')
          return (
            <Badge variant='outline' className={staffStatusBadge[status]}>
              {status}
            </Badge>
          )
        },
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          if (!onDelete) return null
          return (
            <div className='flex justify-end'>
              <Button
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive'
                onClick={() => onDelete(row.original.id)}
                title='Delete invite/staff'
              >
                <Trash2 className='size-4' />
              </Button>
            </div>
          )
        },
      },
    ],
    [onDelete]
  )

  return (
    <SimpleDataTable
      columns={columns}
      data={data}
      loading={loading}
      searchPlaceholder='Search staff...'
      emptyMessage='No staff members found.'
      emptyDescription='Add staff to manage team roles and access.'
      filters={[
        {
          columnId: 'role',
          title: 'Role',
          options: staffRoles.map((role) => ({
            label: role.replace('_', ' '),
            value: role,
          })),
        },
        {
          columnId: 'status',
          title: 'Status',
          options: staffStatuses.map((status) => ({
            label: status,
            value: status,
          })),
        },
      ]}
    />
  )
}
