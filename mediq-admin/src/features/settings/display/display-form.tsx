import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

const languages = [
  { value: 'en', label: 'English' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ha', label: 'Hausa' },
  { value: 'ig', label: 'Igbo' },
]

const timezones = [
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Cairo',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const dateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

const itemsPerPageOptions = ['10', '25', '50', '100']

export function DisplayForm() {
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState('Africa/Lagos')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [use24Hour, setUse24Hour] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState('25')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    toast.success('Display preferences updated')
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Choose the language and timezone used across the app.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-6 sm:grid-cols-2'>
          <div className='grid gap-2'>
            <Label htmlFor='language'>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id='language' className='w-full'>
                <SelectValue placeholder='Select a language' />
              </SelectTrigger>
              <SelectContent>
                {languages.map((language) => (
                  <SelectItem key={language.value} value={language.value}>
                    {language.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='timezone'>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id='timezone' className='w-full'>
                <SelectValue placeholder='Select a timezone' />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((timezone) => (
                  <SelectItem key={timezone} value={timezone}>
                    {timezone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <Separator className='my-0' />
        <CardHeader>
          <CardTitle>Formatting</CardTitle>
          <CardDescription>
            Set how dates and times are displayed in the app.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-6 sm:grid-cols-2'>
          <div className='grid gap-2'>
            <Label htmlFor='date-format'>Date format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger id='date-format' className='w-full'>
                <SelectValue placeholder='Select a date format' />
              </SelectTrigger>
              <SelectContent>
                {dateFormats.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='time-format'>24-hour format</Label>
              <p className='text-sm text-muted-foreground'>
                Display times using the 24-hour clock.
              </p>
            </div>
            <Switch
              id='time-format'
              checked={use24Hour}
              onCheckedChange={setUse24Hour}
            />
          </div>
        </CardContent>
        <Separator className='my-0' />
        <CardHeader>
          <CardTitle>Pagination</CardTitle>
          <CardDescription>
            Set how many items are shown on each page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid max-w-60 gap-2'>
            <Label htmlFor='items-per-page'>Items per page</Label>
            <Select value={itemsPerPage} onValueChange={setItemsPerPage}>
              <SelectTrigger id='items-per-page' className='w-full'>
                <SelectValue placeholder='Select items per page' />
              </SelectTrigger>
              <SelectContent>
                {itemsPerPageOptions.map((count) => (
                  <SelectItem key={count} value={count}>
                    {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className='justify-end'>
          <Button type='submit'>Update display</Button>
        </CardFooter>
      </Card>
    </form>
  )
}
