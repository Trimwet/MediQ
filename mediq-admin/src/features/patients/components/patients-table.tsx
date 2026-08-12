import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { SimpleDataTable } from '@/components/data-table/simple-table'
import { type Patient } from '../schema'

type PatientsTableProps = {
  data: Patient[]
  loading?: boolean
}

export function PatientsTable({ data, loading = false }: PatientsTableProps) {
  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Patient' />
        ),
        cell: ({ row }) => (
          <span className='font-medium'>{row.getValue('name')}</span>
        ),
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Phone' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>{row.getValue('phone')}</span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => row.getValue('email') ?? '—',
        enableSorting: false,
      },
      {
        accessorKey: 'lastVisit',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Last visit' />
        ),
        cell: ({ row }) => {
          const iso = row.getValue<string | null>('lastVisit')
          if (!iso) return <span className='text-muted-foreground'>Never</span>
          return new Date(iso).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        },
      },
      {
        accessorKey: 'visits',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Visits' />
        ),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {row.getValue<number>('visits')}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <SimpleDataTable
      columns={columns}
      data={data}
      loading={loading}
      searchPlaceholder='Search patients...'
    />
  )
}
