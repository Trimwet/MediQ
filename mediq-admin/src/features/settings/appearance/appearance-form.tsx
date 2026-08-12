import { useEffect, useState } from 'react'
import { useTheme, type Theme } from '@/context/theme-provider'
import { getCookie, setCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'

const ACCENT_COLORS = [
  { name: 'MediQ Blue', value: '#2563EB' },
  { name: 'Violet', value: '#7C3AED' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Slate', value: '#64748B' },
] as const

const FONT_SIZES = ['Small', 'Default', 'Large'] as const
const FONT_SIZE_REMS = [0.9375, 1, 1.0625] as const

const ACCENT_COOKIE = 'mediq-accent'
const FONT_SIZE_COOKIE = 'mediq-font-size'
const YEAR = 60 * 60 * 24 * 365

/**
 * Live appearance preferences — no submit button. Every control applies
 * immediately and persists in a cookie, exactly like the theme dropdown in
 * the header. Accent and base font size are applied as CSS custom
 * properties on <html>, which the @theme inline mapping picks up at runtime.
 */
export function AppearanceForm() {
  const { theme, setTheme } = useTheme()
  const [accent, setAccent] = useState<string>(
    () => getCookie(ACCENT_COOKIE) ?? '#2563EB'
  )
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = Number(getCookie(FONT_SIZE_COOKIE))
    return Number.isInteger(saved) && saved >= 0 && saved <= 2 ? saved : 1
  })

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--primary', accent)
    root.style.setProperty('--ring', accent)
    setCookie(ACCENT_COOKIE, accent, YEAR)
  }, [accent])

  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SIZE_REMS[fontSize]}rem`
    setCookie(FONT_SIZE_COOKIE, String(fontSize), YEAR)
  }, [fontSize])

  return (
    <div className='space-y-8'>
      <Card>
        <CardContent className='space-y-8'>
          <div className='grid gap-2'>
            <Label>Theme</Label>
            <p className='text-sm text-muted-foreground'>
              Select the theme for the dashboard. System follows your device
              preference.
            </p>
            <RadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as Theme)}
              className='grid max-w-lg grid-cols-3 gap-4 pt-2'
            >
              {THEME_OPTIONS.map((option) => (
                <div key={option.value} className='grid gap-1.5'>
                  <Label className='[&:has([data-state=checked])>div]:border-primary'>
                    <RadioGroupItem
                      value={option.value}
                      className='sr-only'
                    />
                    {option.preview}
                  </Label>
                  <span className='block w-full p-2 text-center font-normal'>
                    {option.label}
                  </span>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className='grid gap-2'>
            <Label>Accent color</Label>
            <p className='text-sm text-muted-foreground'>
              Choose the accent color used for interactive elements.
            </p>
            <RadioGroup
              value={accent}
              onValueChange={setAccent}
              className='flex flex-wrap gap-3 pt-2'
            >
              {ACCENT_COLORS.map((color) => (
                <div key={color.value} className='grid gap-1.5'>
                  <Label
                    className='[&:has([data-state=checked])>span]:ring-2 [&:has([data-state=checked])>span]:ring-ring [&:has([data-state=checked])>span]:ring-offset-2'
                    title={color.name}
                  >
                    <RadioGroupItem value={color.value} className='sr-only' />
                    <span
                      className='block size-8 cursor-pointer rounded-full ring-ring ring-offset-2 ring-offset-background transition-shadow hover:ring-2'
                      style={{ backgroundColor: color.value }}
                    />
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className='grid gap-2'>
            <Label>Font size</Label>
            <p className='text-sm text-muted-foreground'>
              Adjust the base font size of the dashboard.
            </p>
            <Slider
              min={0}
              max={2}
              step={1}
              value={[fontSize]}
              onValueChange={(value) => setFontSize(value[0])}
              className='max-w-md py-3'
            />
            <div className='flex max-w-md justify-between text-xs text-muted-foreground'>
              {FONT_SIZES.map((size, index) => (
                <span
                  key={size}
                  className={cn(
                    index === fontSize && 'font-medium text-foreground'
                  )}
                >
                  {size}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const THEME_OPTIONS = [
  {
    value: 'light' as const,
    label: 'Light',
    preview: (
      <div className='items-center rounded-md border-2 border-muted p-1 hover:border-accent'>
        <div className='space-y-2 rounded-sm bg-[#ecedef] p-2'>
          <div className='space-y-2 rounded-md bg-white p-2 shadow-xs'>
            <div className='h-2 w-16 rounded-lg bg-[#ecedef]' />
            <div className='h-2 w-16 rounded-lg bg-[#ecedef]' />
          </div>
        </div>
      </div>
    ),
  },
  {
    value: 'dark' as const,
    label: 'Dark',
    preview: (
      <div className='items-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground'>
        <div className='space-y-2 rounded-sm bg-slate-950 p-2'>
          <div className='space-y-2 rounded-md bg-slate-800 p-2 shadow-xs'>
            <div className='h-2 w-16 rounded-lg bg-slate-400' />
            <div className='h-2 w-16 rounded-lg bg-slate-400' />
          </div>
        </div>
      </div>
    ),
  },
  {
    value: 'system' as const,
    label: 'System',
    preview: (
      <div className='items-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground'>
        <div className='grid grid-cols-2 gap-1 rounded-sm p-1'>
          <div className='space-y-2 rounded-sm bg-[#ecedef] p-2'>
            <div className='space-y-2 rounded-md bg-white p-2 shadow-xs'>
              <div className='h-2 w-14 rounded-lg bg-[#ecedef]' />
              <div className='h-2 w-14 rounded-lg bg-[#ecedef]' />
            </div>
          </div>
          <div className='space-y-2 rounded-sm bg-slate-950 p-2'>
            <div className='space-y-2 rounded-md bg-slate-800 p-2 shadow-xs'>
              <div className='h-2 w-14 rounded-lg bg-slate-400' />
              <div className='h-2 w-14 rounded-lg bg-slate-400' />
            </div>
          </div>
        </div>
      </div>
    ),
  },
]
