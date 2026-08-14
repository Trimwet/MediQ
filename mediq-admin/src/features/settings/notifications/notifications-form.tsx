import { type ReactNode } from 'react'
import { z } from 'zod'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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

type SwitchFieldName =
  | 'emailAppointmentReminders'
  | 'emailQueueUpdates'
  | 'emailDailySummary'
  | 'pushNotifications'
  | 'smsNotifications'
  | 'quietHoursEnabled'

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

  const quietHoursEnabled = useWatch({
    control: form.control,
    name: 'quietHoursEnabled',
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() =>
          toast.success('Notification preferences saved')
        )}
        className='space-y-8'
      >
        <div className='overflow-hidden rounded-xl border bg-card'>
          <SettingsGroup
            title='Email notifications'
            desc='Choose what you receive by email.'
          >
            <SwitchRow
              form={form}
              name='emailAppointmentReminders'
              label='Appointment reminders'
              desc='Email me when an appointment is coming up.'
            />
            <SwitchRow
              form={form}
              name='emailQueueUpdates'
              label='Queue updates'
              desc='Email me about changes to my queue position and status.'
            />
            <SwitchRow
              form={form}
              name='emailDailySummary'
              label='Daily summary'
              desc="Email me a summary of the day's activity."
            />
          </SettingsGroup>

          <Separator />

          <SettingsGroup
            title='Push notifications'
            desc='Real-time alerts delivered to this device.'
          >
            <SwitchRow
              form={form}
              name='pushNotifications'
              label='Enable push notifications'
              desc='Receive instant alerts on this device.'
            />
          </SettingsGroup>

          <Separator />

          <SettingsGroup
            title='SMS notifications'
            desc='Text message alerts sent to your phone.'
          >
            <SwitchRow
              form={form}
              name='smsNotifications'
              label='Enable SMS notifications'
              desc='Receive text messages about your appointments and queue.'
            />
          </SettingsGroup>

          <Separator />

          <SettingsGroup
            title='Notification frequency'
            desc='How often you want to receive digest notifications.'
          >
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
                    Digests batch non-urgent updates and are sent at a scheduled
                    time.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroup>

          <Separator />

          <SettingsGroup
            title='Quiet hours'
            desc='Mute non-urgent notifications during a set time range.'
          >
            <div className='space-y-4'>
              <SwitchRow
                form={form}
                name='quietHoursEnabled'
                label='Enable quiet hours'
                desc='Suppress notifications between the times below.'
              />
              {quietHoursEnabled && (
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
              )}
            </div>
          </SettingsGroup>
        </div>

        <Button type='submit'>Save notifications</Button>
      </form>
    </Form>
  )
}

function SettingsGroup({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: ReactNode
}) {
  return (
    <section className='px-5 py-4'>
      <h3 className='text-sm font-semibold tracking-tight'>{title}</h3>
      <p className='mt-0.5 text-sm text-muted-foreground'>{desc}</p>
      <div className='mt-4 space-y-4'>{children}</div>
    </section>
  )
}

function SwitchRow({
  form,
  name,
  label,
  desc,
}: {
  form: UseFormReturn<NotificationsFormValues>
  name: SwitchFieldName
  label: string
  desc: string
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className='flex flex-row items-center justify-between gap-4'>
          <div className='space-y-0.5'>
            <FormLabel className='text-sm'>{label}</FormLabel>
            <FormDescription>{desc}</FormDescription>
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  )
}
