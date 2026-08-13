import { z } from 'zod'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  ROOM_LABEL_SUGGESTIONS,
  useFacilityStore,
} from '@/stores/facility-store'
import { cn } from '@/lib/utils'
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

const facilityFormSchema = z.object({
  trackRooms: z.boolean(),
  roomLabel: z
    .string()
    .trim()
    .min(1, 'Enter a name for your rooms (e.g. Room or Office).')
    .max(24, 'Keep the label under 24 characters.'),
})

type FacilityFormValues = z.infer<typeof facilityFormSchema>

export function FacilityForm() {
  const trackRooms = useFacilityStore((s) => s.trackRooms)
  const roomLabel = useFacilityStore((s) => s.roomLabel)
  const setTrackRooms = useFacilityStore((s) => s.setTrackRooms)
  const setRoomLabel = useFacilityStore((s) => s.setRoomLabel)

  const form = useForm<FacilityFormValues>({
    resolver: zodResolver(facilityFormSchema),
    defaultValues: { trackRooms, roomLabel },
    mode: 'onChange',
  })

  const trackRoomsValue = useWatch({
    control: form.control,
    name: 'trackRooms',
  })

  function onSubmit(values: FacilityFormValues) {
    setTrackRooms(values.trackRooms)
    setRoomLabel(values.roomLabel)
    toast.success('Facility settings saved')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <Card>
          <CardHeader>
            <CardTitle>Rooms &amp; locations</CardTitle>
            <CardDescription>
              Choose whether your clinic tracks rooms, and what to call them.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <FormField
              control={form.control}
              name='trackRooms'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between gap-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Track rooms</FormLabel>
                    <FormDescription>
                      Show the rooms module and room details in the queue. Turn
                      this off if patients are seen without assigned rooms.
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
            {trackRoomsValue && (
              <>
                <Separator />
                <FormField
                  control={form.control}
                  name='roomLabel'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Room label</FormLabel>
                      <FormControl>
                        <Input placeholder='Room' {...field} />
                      </FormControl>
                      <FormDescription>
                        Used across the app — &quot;Room 2&quot;, &quot;In
                        room&quot;, and the rooms page.
                      </FormDescription>
                      <div className='flex flex-wrap gap-1.5 pt-1'>
                        {ROOM_LABEL_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type='button'
                            onClick={() => field.onChange(suggestion)}
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                              field.value === suggestion
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:bg-accent'
                            )}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Button type='submit'>Save facility settings</Button>
      </form>
    </Form>
  )
}
