import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DoorOpen } from 'lucide-react'
import { useFacilityStore } from '@/stores/facility-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SelectDropdown } from '@/components/select-dropdown'
import { roomTypeLabel, roomTypes, type Room } from '../schema'

function createFormSchema(roomLabel: string) {
  const noun = roomLabel.toLowerCase()
  return z.object({
    number: z.string().min(1, `Please enter a ${noun} number.`),
    type: z.string().min(1, 'Please choose a type.'),
  })
}

type RoomFormSchema = ReturnType<typeof createFormSchema>
type RoomForm = z.infer<RoomFormSchema>

type RoomDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (room: Omit<Room, 'id'>) => void
}

export function RoomDialog({ open, onOpenChange, onCreated }: RoomDialogProps) {
  const roomLabel = useFacilityStore((s) => s.roomLabel)
  const noun = roomLabel.toLowerCase()
  const form = useForm<RoomForm>({
    resolver: zodResolver(createFormSchema(roomLabel)),
    defaultValues: { number: '', type: '' },
    mode: 'onTouched',
  })

  function onSubmit(values: RoomForm) {
    onCreated({
      number: values.number,
      type: values.type as Room['type'],
      status: 'available',
    })
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2'>
            <DoorOpen /> Add {noun}
          </DialogTitle>
          <DialogDescription>
            Add a {noun} to the clinic and set its type.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='room-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='number'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{roomLabel} number</FormLabel>
                  <FormControl>
                    <Input placeholder='eg: 9' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{roomLabel} type</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder={`Select a ${noun} type`}
                    items={roomTypes.map((type) => ({
                      value: type,
                      label: roomTypeLabel[type],
                    }))}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogClose>
          <Button
            type='submit'
            form='room-form'
            disabled={form.formState.isSubmitting || (form.formState.isDirty && !form.formState.isValid)}
          >
            Add {noun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
