import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DoorOpen } from 'lucide-react'
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

const formSchema = z.object({
  number: z.string().min(1, 'Please enter a room number.'),
  type: z.string().min(1, 'Please choose a room type.'),
})

type RoomForm = z.infer<typeof formSchema>

type RoomDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (room: Omit<Room, 'id'>) => void
}

export function RoomDialog({ open, onOpenChange, onCreated }: RoomDialogProps) {
  const form = useForm<RoomForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { number: '', type: '' },
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
            <DoorOpen /> Add room
          </DialogTitle>
          <DialogDescription>
            Add a room to the clinic and set its type.
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
                  <FormLabel>Room number</FormLabel>
                  <FormControl>
                    <Input placeholder='eg: Room 9' {...field} />
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
                  <FormLabel>Room type</FormLabel>
                  <SelectDropdown
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    placeholder='Select a room type'
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
          <Button type='submit' form='room-form'>
            Add room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
