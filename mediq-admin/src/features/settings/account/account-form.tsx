import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { PasswordInput } from '@/components/password-input'

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Please enter your current password.'),
    newPassword: z
      .string()
      .min(7, 'Password must be at least 7 characters long.'),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

type PasswordFormValues = z.infer<typeof passwordFormSchema>

export function AccountForm() {
  const [marketingEmails, setMarketingEmails] = useState(true)
  const [securityEmails, setSecurityEmails] = useState(true)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const handleDeleteAccount = () => {
    if (confirmText !== 'delete') return
    setConfirmText('')
    toast.success('Your account has been deleted.')
  }

  return (
    <div className='space-y-8'>
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(() => {
                passwordForm.reset()
                toast.success('Password updated')
              })}
              className='space-y-6'
            >
              <FormField
                control={passwordForm.control}
                name='currentPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder='Enter your current password'
                        autoComplete='current-password'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name='newPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder='Enter a new password'
                        autoComplete='new-password'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      At least 7 characters long.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder='Re-enter your new password'
                        autoComplete='new-password'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type='submit'>Change password</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Preferences</CardTitle>
          <CardDescription>
            Choose what emails you receive from us.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-row items-center justify-between rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <Label className='text-base'>Marketing emails</Label>
              <p className='text-sm text-muted-foreground'>
                Receive emails about new products, features, and more.
              </p>
            </div>
            <Switch
              checked={marketingEmails}
              onCheckedChange={setMarketingEmails}
            />
          </div>
          <Separator className='my-4' />
          <div className='flex flex-row items-center justify-between rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <Label className='text-base'>Security emails</Label>
              <p className='text-sm text-muted-foreground'>
                Receive emails about your account activity and security.
              </p>
            </div>
            <Switch
              checked={securityEmails}
              onCheckedChange={setSecurityEmails}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-row items-center justify-between rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <Label className='text-base'>Require a one-time code</Label>
              <p className='text-sm text-muted-foreground'>
                Get a verification code via authenticator app when signing in.
              </p>
            </div>
            <Switch
              checked={twoFactorEnabled}
              onCheckedChange={setTwoFactorEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card className='border-destructive/50'>
        <CardHeader>
          <CardTitle className='text-destructive'>Delete Account</CardTitle>
          <CardDescription>
            Permanently remove your account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>
            This action cannot be undone. All of your data will be permanently
            deleted from our servers.
          </p>
          <Separator className='my-4' />
          <div className='space-y-3'>
            <Label htmlFor='delete-account-confirm'>
              Type <span className='font-semibold'>delete</span> to confirm
            </Label>
            <Input
              id='delete-account-confirm'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type delete to confirm'
            />
            <Button
              variant='destructive'
              disabled={confirmText !== 'delete'}
              onClick={handleDeleteAccount}
            >
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
