import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { SimpleDataTable } from '@/components/data-table/simple-table'
import { callTypes, roles } from '../data/data'
import { type User } from '../data/schema'
import { users } from '../data/users'

const roleLabels = Object.fromEntries(
  roles.map((role) => [role.value, role.label])
) as Record<User['role'], string>

const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'firstName',
    header: 'Name',
    cell: ({ row }) => (
      <span className='font-medium'>
        {row.original.firstName} {row.original.lastName}
      </span>
    ),
  },
  {
    accessorKey: 'username',
    header: 'Username',
    cell: ({ row }) => (
      <span className='text-muted-foreground'>@{row.original.username}</span>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <span className='text-muted-foreground'>{row.original.email}</span>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => (
      <Badge variant='outline'>{roleLabels[row.original.role]}</Badge>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge variant='outline' className={callTypes.get(status)}>
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Joined',
    cell: ({ row }) => (
      <span className='text-muted-foreground'>
        {row.original.createdAt.toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
    ),
  },
]

export function UsersTable() {
  return (
    <SimpleDataTable
      columns={columns}
      data={users}
      searchPlaceholder='Filter users...'
      filters={[
        {
          columnId: 'status',
          title: 'Status',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
            { label: 'Invited', value: 'invited' },
            { label: 'Suspended', value: 'suspended' },
          ],
        },
        {
          columnId: 'role',
          title: 'Role',
          options: roles.map((role) => ({
            label: role.label,
            value: role.value,
            icon: role.icon,
          })),
        },
      ]}
      emptyMessage='No users found.'
      emptyDescription='Users appear here once they are invited or registered.'
    />
  )
}
