import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/stores/auth-store'
import { roleLabels, ROLES } from '@/config/rbac'
import { verifyAccount } from '@/data/mock/accounts'
import { sleep, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { SelectDropdown } from '@/components/select-dropdown'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter your email.' : undefined),
  }),
  password: z
    .string()
    .min(1, 'Please enter your password.')
    .min(7, 'Password must be at least 7 characters long.'),
  // Demo-only: with no backend yet, the signed-in role is chosen here.
  role: z.enum(ROLES),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'admin',
    },
  })

  function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    // Mock auth: if this email was provisioned through the booking flow, the
    // role and the temporary password live in the account registry.
    const account = verifyAccount(data.email, data.password)
    if (account === null) {
      setIsLoading(false)
      toast.error('Invalid email or password.')
      return
    }

    toast.promise(sleep(2000), {
      loading: 'Signing in...',
      success: () => {
        setIsLoading(false)

        // Mock successful authentication with expiry computed at success time.
        // Production: role claims come from Supabase Auth.
        const mockUser = {
          accountNo: 'ACC001',
          email: data.email,
          role: account ? account.role : [data.role],
          exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
        }

        // Set user and access token
        auth.setUser(mockUser)
        auth.setAccessToken('mock-access-token')

        // First login after booking: force the password change.
        const mustChangePassword = account?.mustChangePassword ?? false
        // Role-aware default: staff land on the dashboard, patients on their
        // portal. The landing page is public, so `/` is never the post-login
        // destination.
        const role = account ? account.role : [data.role]
        const defaultPath = role.includes('patient')
          ? '/patient'
          : '/admin/dashboard'
        const targetPath = mustChangePassword
          ? '/change-password'
          : redirectTo || defaultPath
        navigate({ to: targetPath, replace: true })

        return `Welcome back, ${data.email}!`
      },
      error: 'Error',
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='••••••••' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='absolute inset-e-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='role'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <SelectDropdown
                defaultValue={field.value}
                onValueChange={field.onChange}
                className='w-full'
                items={ROLES.map((role) => ({
                  label: roleLabels[role],
                  value: role,
                }))}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>
        <p className='text-center text-sm text-muted-foreground'>
          Visiting as a patient?{' '}
          <Link
            to='/book'
            className='font-medium text-primary underline-offset-4 hover:underline'
          >
            Book an appointment — no account needed
          </Link>
        </p>
      </form>
    </Form>
  )
}
