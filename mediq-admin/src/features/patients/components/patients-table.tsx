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
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Email' />
        ),
        cell: ({ row }) => {
          const email = row.getValue<string | undefined>('email')
          return email ? (
            <span className='text-muted-foreground'>{email}</span>
          ) : (
            <span className='text-muted-foreground'>—</span>
          )
        },
        filterFn: (row, id, value) => {
          const email = row.getValue<string | undefined>(id)
          const hasEmail = Boolean(email)
          return (value as string[]).some((v) =>
            v === 'has_email' ? hasEmail : !hasEmail
          )
        },
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
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue<string | null>(columnId)
          const b = rowB.getValue<string | null>(columnId)
          if (a === b) return 0
          if (a === null) return 1
          if (b === null) return -1
          return new Date(a).getTime() - new Date(b).getTime()
        },
        filterFn: (row, id, value) => {
          const iso = row.getValue<string | null>(id)
          return (value as string[]).some((v) => {
            if (v === 'never') return iso === null
            if (v === 'visited') return iso !== null
            if (!iso) return false
            const daysAgo =
              (Date.now() - new Date(iso).getTime()) / 86_400_000
            if (v === 'week') return daysAgo <= 7
            if (v === 'month') return daysAgo > 7 && daysAgo <= 30
            if (v === 'older') return daysAgo > 30
            return false
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
        filterFn: (row, id, value) => {
          const count = row.getValue<number>(id)
          return (value as string[]).some((v) => {
            if (v === '0') return count === 0
            if (v === '1-2') return count >= 1 && count <= 2
            if (v === '3-5') return count >= 3 && count <= 5
            if (v === '6+') return count >= 6
            return false
          })
        },
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
      emptyMessage='No patients registered yet.'
      emptyDescription='Patients will appear here once they are checked in.'
      filters={[
        {
          columnId: 'visits',
          title: 'Visits',
          options: [
            { label: 'New (0)', value: '0' },
            { label: '1–2 visits', value: '1-2' },
            { label: '3–5 visits', value: '3-5' },
            { label: '6+ visits', value: '6+' },
          ],
        },
        {
          columnId: 'lastVisit',
          title: 'Last visit',
          options: [
            { label: 'Last 7 days', value: 'week' },
            { label: 'Last 30 days', value: 'month' },
            { label: 'Older', value: 'older' },
            { label: 'Never', value: 'never' },
          ],
        },
        {
          columnId: 'email',
          title: 'Contact',
          options: [
            { label: 'Has email', value: 'has_email' },
            { label: 'No email', value: 'no_email' },
          ],
        },
      ]}
    />
  )
}
