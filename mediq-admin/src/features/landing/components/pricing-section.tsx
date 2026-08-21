'use client'

import { useState, useRef, useId } from 'react'
import { Link } from '@tanstack/react-router'
import NumberFlow from '@number-flow/react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { TimelineAnimation } from '@/components/ui/timeline-animation'

const freePlan = {
  name: 'Free',
  description: 'Try MediQ with your small practice',
  monthly: 0,
  yearly: 0,
  features: ['2 staff', '1 location', '50 appointments / mo', 'Basic queue'],
  cta: 'Start free',
  to: '/create-clinic' as const,
} as const

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for small clinics getting started',
    monthly: 15000,
    yearly: 12000,
    features: [
      'Up to 5 staff members',
      '1 clinic location',
      'Patient records & appointments',
      'Live queue management',
      'In-app notifications',
    ],
    cta: 'Choose Starter',
    to: '/create-clinic' as const,
    variant: 'outline' as const,
  },
  {
    name: 'Professional',
    description: 'For growing practices that need more',
    monthly: 50000,
    yearly: 40000,
    features: [
      'Unlimited staff members',
      'Up to 5 clinic locations',
      'Full analytics dashboard',
      'Email & SMS notifications',
      'Role-based access control',
    ],
    cta: 'Start 14-day trial',
    to: '/create-clinic' as const,
    variant: 'default' as const,
    featured: true,
  },
  {
    name: 'Enterprise',
    description: 'Custom solutions for large facilities',
    monthly: 150000,
    yearly: 120000,
    features: [
      'Unlimited everything',
      'Multi-site management',
      'Custom integrations & API',
      'Dedicated support & SLA',
      'On-premise deployment option',
    ],
    cta: 'Contact sales',
    to: '/sign-up' as const,
    variant: 'outline' as const,
  },
]

export function PricingSection() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly')
  const id = useId()
  const timelineRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={timelineRef} className='bg-muted/40 py-20 sm:py-24'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6'>
        <div className='text-center'>
          <TimelineAnimation
            animationNum={1}
            timelineRef={timelineRef}
            as='h2'
            className='font-manrope text-3xl font-bold tracking-tight sm:text-4xl'
          >
            Plans that grow with your clinic
          </TimelineAnimation>
          <TimelineAnimation
            animationNum={2}
            timelineRef={timelineRef}
            as='p'
            className='mt-3 text-muted-foreground sm:text-base'
          >
            Unlock the full potential of your practice with plans designed to
            scale.
          </TimelineAnimation>
          <TimelineAnimation
            animationNum={3}
            timelineRef={timelineRef}
            className='mt-6 inline-flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm'
          >
            <span
              className={cn(
                'text-sm font-medium transition-colors',
                billing === 'monthly'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              Monthly
            </span>
            <Switch
              id={id}
              checked={billing === 'yearly'}
              className='bg-muted data-[state=checked]:bg-primary'
              onCheckedChange={(checked: boolean) =>
                setBilling(checked ? 'yearly' : 'monthly')
              }
            />
            <div className='flex items-center gap-1.5'>
              <span
                className={cn(
                  'text-sm font-medium transition-colors',
                  billing === 'yearly'
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                Yearly
              </span>
              <span
                className={cn(
                  'rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary',
                  billing === 'yearly' ? 'opacity-100' : 'opacity-50'
                )}
              >
                Save 20%
              </span>
            </div>
          </TimelineAnimation>
        </div>

        {/* Free — horizontal banner, not a 4th card */}
        <TimelineAnimation
          animationNum={4}
          timelineRef={timelineRef}
          className='mx-auto mt-10 flex max-w-4xl flex-col items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-5 shadow-sm sm:flex-row sm:gap-6'
        >
          <div className='flex flex-1 items-center gap-4 text-left'>
            <span className='hidden size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground sm:flex'>₦0</span>
            <div>
              <p className='text-sm font-bold'>
                Free <span className='font-normal text-muted-foreground'>— {freePlan.description}</span>
              </p>
              <p className='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                {freePlan.features.map((f) => (
                  <span key={f} className='inline-flex items-center gap-1'>
                    <Check className='size-3 text-primary' /> {f}
                  </span>
                ))}
              </p>
            </div>
          </div>
          <Button variant='outline' className='h-10 shrink-0 rounded-xl px-6' asChild>
            <Link to={freePlan.to}>{freePlan.cta}</Link>
          </Button>
        </TimelineAnimation>

        <div className='mt-6 grid gap-6 lg:grid-cols-3'>
          {plans.map((plan, index) => (
            <TimelineAnimation
              key={plan.name}
              animationNum={5 + index}
              timelineRef={timelineRef}
              className={cn(
                'flex flex-col rounded-2xl border p-6 transition-all',
                plan.featured
                  ? 'relative z-10 border-transparent bg-foreground text-background shadow-2xl'
                  : 'border-border bg-card shadow-sm'
              )}
            >
              <div className='mb-4 text-left'>
                <h3 className='font-manrope text-lg font-bold'>{plan.name}</h3>
                <p
                  className={cn(
                    'mt-1 text-sm',
                    plan.featured
                      ? 'text-background/60'
                      : 'text-muted-foreground'
                  )}
                >
                  {plan.description}
                </p>
              </div>

              <div className='mb-6 flex items-baseline gap-1 text-left'>
                <span
                  className={cn(
                    'text-2xl font-medium',
                    plan.featured ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  ₦
                </span>
                <span
                  className={cn(
                    'text-5xl font-bold',
                    plan.featured ? 'text-background' : 'text-foreground'
                  )}
                >
                  <NumberFlow
                    value={billing === 'monthly' ? plan.monthly : plan.yearly}
                  />
                </span>
                <span
                  className={cn(
                    'text-sm',
                    plan.featured
                      ? 'text-background/50'
                      : 'text-muted-foreground'
                  )}
                >
                  /{billing === 'monthly' ? 'mo' : 'yr'}
                </span>
              </div>

              <Button
                variant={plan.variant as 'default' | 'outline'}
                className={cn(
                  'mb-6 h-12 w-full rounded-xl text-base font-semibold',
                  plan.featured
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : ''
                )}
                asChild
              >
                <Link to={plan.to}>{plan.cta}</Link>
              </Button>

              <div
                className={cn(
                  'space-y-3 rounded-xl border p-4',
                  plan.featured
                    ? 'border-background/10 bg-background/5'
                    : 'border-border bg-muted/50'
                )}
              >
                {plan.features.map((feature, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-3 text-sm',
                      plan.featured
                        ? 'text-background/80'
                        : 'text-foreground/70'
                    )}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        plan.featured ? 'text-primary' : 'text-primary'
                      )}
                    />
                    {feature}
                  </div>
                ))}
              </div>
            </TimelineAnimation>
          ))}
        </div>
      </div>
    </section>
  )
}
