import { useEffect } from 'react'
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
import { useCurrentClinic } from '@/lib/clinic-context'

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
  const { clinicId } = useCurrentClinic()
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

  // Clinic-scoped hydration: prefer `mediq_facility:${clinicId}` if present,
  // fallback to legacy `mediq_facility`, and migrate legacy -> scoped.
  useEffect(() => {
    if (!clinicId) return
    try {
      const scopedKey = `mediq_facility:${clinicId}`
      const scopedRaw = localStorage.getItem(scopedKey)
      if (scopedRaw) {
        const parsed = JSON.parse(scopedRaw) as
          | { state?: { trackRooms?: unknown; roomLabel?: unknown } }
          | { trackRooms?: unknown; roomLabel?: unknown }
        const scopedState = (parsed as { state?: unknown }).state ?? parsed
        const nextTrackRooms =
          typeof (scopedState as { trackRooms?: unknown }).trackRooms ===
          'boolean'
            ? (scopedState as { trackRooms: boolean }).trackRooms
            : null
        const nextRoomLabel =
          typeof (scopedState as { roomLabel?: unknown }).roomLabel === 'string'
            ? (scopedState as { roomLabel: string }).roomLabel
            : null
        if (nextTrackRooms !== null) setTrackRooms(nextTrackRooms)
        if (nextRoomLabel !== null) setRoomLabel(nextRoomLabel)
        form.reset({
          trackRooms: nextTrackRooms ?? trackRooms,
          roomLabel: nextRoomLabel ?? roomLabel,
        })
      } else {
        // No scoped entry yet — migrate legacy global value if it exists
        const legacyRaw = localStorage.getItem('mediq_facility')
        if (legacyRaw) {
          try {
            localStorage.setItem(scopedKey, legacyRaw)
          } catch {
            // ignore quota
          }
        }
      }
    } catch {
      // ignore parse / storage errors
    }
    // Only re-run when clinicId changes; setters and form are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  // Keep form in sync when store rehydrates from storage (e.g., after clinic switch)
  useEffect(() => {
    form.reset({ trackRooms, roomLabel })
  }, [trackRooms, roomLabel, form])

  function onSubmit(values: FacilityFormValues) {
    setTrackRooms(values.trackRooms)
    setRoomLabel(values.roomLabel)
    // Ensure both legacy and clinic-scoped keys are written (store's custom
    // storage already does this, but we double-write here for explicitness and
    // to handle the case where clinicId became available after store init).
    if (clinicId) {
      try {
        const serialized = localStorage.getItem('mediq_facility')
        if (serialized) {
          localStorage.setItem(`mediq_facility:${clinicId}`, serialized)
        } else {
          // Fallback: construct payload if persist hasn't flushed yet
          const payload = JSON.stringify({
            state: {
              trackRooms: values.trackRooms,
              roomLabel: values.roomLabel.trim() || 'Room',
            },
            version: 0,
          })
          localStorage.setItem('mediq_facility', payload)
          localStorage.setItem(`mediq_facility:${clinicId}`, payload)
        }
      } catch {
        // ignore
      }
    }
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
