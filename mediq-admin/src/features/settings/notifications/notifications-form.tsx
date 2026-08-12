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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

const notificationsFormSchema = z
  .object({
    emailAppointmentReminders: z.boolean(),
    emailQueueUpdates: z.boolean(),
    emailDailySummary: z.boolean(),
    pushNotifications: z.boolean(),
    smsNotifications: z.boolean(),
    frequency: z.enum(['realtime', 'hourly', 'daily'], {
      error: (iss) =>
        iss.input === undefined
          ? 'Please select a notification frequency.'
          : undefined,
    }),
    quietHoursEnabled: z.boolean(),
    quietHoursStart: z.string(),
    quietHoursEnd: z.string(),
  })
  .refine(
    (data) =>
      !data.quietHoursEnabled ||
      (data.quietHoursStart !== '' && data.quietHoursEnd !== ''),
    {
      message: 'Set both a start and end time for quiet hours.',
      path: ['quietHoursStart'],
    }
  )

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>

// This can come from your database or API.
const defaultValues: Partial<NotificationsFormValues> = {
  emailAppointmentReminders: true,
  emailQueueUpdates: true,
  emailDailySummary: false,
  pushNotifications: true,
  smsNotifications: false,
  frequency: 'realtime',
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '07:00',
}

export function NotificationsForm() {
  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  const quietHoursEnabled = form.watch('quietHoursEnabled')

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => toast.success('Notification preferences saved'))}
        className='space-y-8'
      >
        <Card>
          <CardHeader>
            <CardTitle>Email notifications</CardTitle>
            <CardDescription>
              Choose what you receive by email.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <FormField
              control={form.control}
              name='emailAppointmentReminders'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between gap-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Appointment reminders
                    </FormLabel>
                    <FormDescription>
                      Email me when an appointment is coming up.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Separator />
            <FormField
              control={form.control}
              name='emailQueueUpdates'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between gap-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Queue updates</FormLabel>
                    <FormDescription>
                      Email me about changes to my queue position and status.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Separator />
            <FormField
              control={form.control}
              name='emailDailySummary'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between gap-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Daily summary</FormLabel>
                    <FormDescription>
                      Email me a summary of the day's activity.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Push notifications</CardTitle>
            <CardDescription>
              Real-time alerts delivered to this device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name='pushNotifications'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between gap-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Enable push notifications
                    </FormLabel>
                    <FormDescription>
                      Receive instant alerts on this device.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SMS notifications</CardTitle>
            <CardDescription>
              Text message alerts sent to your phone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name='smsNotifications'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between gap-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Enable SMS notifications
                    </FormLabel>
                    <FormDescription>
                      Receive text messages about your appointments and queue.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification frequency</CardTitle>
            <CardDescription>
              How often you want to receive digest notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name='frequency'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery frequency</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select a frequency' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='realtime'>Real-time</SelectItem>
                      <SelectItem value='hourly'>Hourly digest</SelectItem>
                      <SelectItem value='daily'>Daily digest</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Digests batch non-urgent updates and are sent at a
                    scheduled time.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quiet hours</CardTitle>
            <CardDescription>
              Mute non-urgent notifications during a set time range.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <FormField
              control={form.control}
              name='quietHoursEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between gap-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Enable quiet hours
                    </FormLabel>
                    <FormDescription>
                      Suppress notifications between the times below.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {quietHoursEnabled && (
              <>
                <Separator />
                <div className='flex flex-col gap-4 sm:flex-row'>
                  <FormField
                    control={form.control}
                    name='quietHoursStart'
                    render={({ field }) => (
                      <FormItem className='flex flex-col gap-2'>
                        <Label>From</Label>
                        <FormControl>
                          <Input type='time' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='quietHoursEnd'
                    render={({ field }) => (
                      <FormItem className='flex flex-col gap-2'>
                        <Label>To</Label>
                        <FormControl>
                          <Input type='time' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Button type='submit'>Save notifications</Button>
      </form>
    </Form>
  )
}
