import { z } from 'zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth-store'

const profileFormSchema = z.object({
  displayName: z
    .string('Please enter your display name.')
    .min(2, 'Display name must be at least 2 characters.')
    .max(50, 'Display name must not be longer than 50 characters.'),
  bio: z.string().max(160).optional(),
  urls: z
    .array(
      z.object({
        value: z.url('Please enter a valid URL.').or(z.literal('')),
      })
    )
    .optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export function ProfileForm() {
  const user = useAuthStore((state) => state.auth.user)
  const email = user?.email ?? ''
  const displayName = email.split('@')[0] || 'Staff'

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName,
      bio: '',
      urls: [{ value: '' }],
    },
    mode: 'onChange',
  })

  const { fields, append } = useFieldArray({
    name: 'urls',
    control: form.control,
  })

  function onSubmit() {
    toast.success('Profile updated')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='displayName'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input placeholder='Your display name' {...field} />
              </FormControl>
              <FormDescription>
                Shown to your colleagues across the clinic dashboard.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='grid gap-2'>
          <Label>Email</Label>
          <Input value={email} readOnly disabled />
          <p className='text-sm text-muted-foreground'>
            Your account email, used for sign-in and notifications.
          </p>
        </div>
        <FormField
          control={form.control}
          name='bio'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Tell your colleagues a little about yourself'
                  className='resize-none'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A short introduction shown on your profile.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          {fields.map((field, index) => (
            <FormField
              control={form.control}
              key={field.id}
              name={`urls.${index}.value`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(index !== 0 && 'sr-only')}>
                    Links
                  </FormLabel>
                  <FormDescription className={cn(index !== 0 && 'sr-only')}>
                    Add links to your website, blog, or social media profiles.
                  </FormDescription>
                  <FormControl className={cn(index !== 0 && 'mt-1.5')}>
                    <Input placeholder='https://' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='mt-2'
            onClick={() => append({ value: '' })}
          >
            Add link
          </Button>
        </div>
        <Button type='submit'>Update profile</Button>
      </form>
    </Form>
  )
}
