import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, SearchX, ChevronDown } from 'lucide-react'
import { faqs } from '@/data/landing/faq'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_public/faq')({
  component: FAQPage,
})

function FAQItem({
  question,
  answer,
}: {
  question: string
  answer: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className='border-b border-border last:border-0'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='w-full py-5 flex items-center justify-between gap-4 text-left group'
      >
        <span
          className={cn(
            'text-base font-medium transition-colors',
            isOpen ? 'text-primary' : 'text-foreground group-hover:text-primary',
          )}
        >
          {question}
        </span>
        <ChevronDown
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform duration-300',
            isOpen && 'rotate-180 text-primary',
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <p className='pb-5 text-sm md:text-base text-muted-foreground leading-relaxed'>{answer}</p>
      </div>
    </div>
  )
}

function FAQPage() {
  const [search, setSearch] = useState('')

  const filtered = faqs.filter((faq) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q)
    )
  })

  return (
    <div className='pb-24'>
      {/* Header */}
      <section className='bg-muted/40 py-20 text-center'>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <p className='mb-4 text-xs font-semibold uppercase tracking-widest text-primary'>
            Support
          </p>
          <h1 className='font-manrope text-4xl sm:text-5xl font-bold tracking-tight mb-4'>
            Frequently Asked Questions
          </h1>
          <p className='mx-auto max-w-2xl text-lg text-muted-foreground'>
            Find answers to common questions about our services, appointments,
            and hospital policies.
          </p>
        </div>
      </section>

      <div className='mx-auto max-w-3xl px-4 sm:px-6 py-20'>
        {/* Search */}
        <div className='mx-auto max-w-3xl mb-12'>
          <div className='relative'>
            <Search className='absolute left-5 top-1/2 -translate-y-1/2 size-6 text-muted-foreground' />
            <Input
              placeholder='Search for questions...'
              className='pl-14 py-5 text-base rounded-xl bg-card shadow-sm border-border'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* FAQ List */}
        <div className='rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm'>
          {filtered.length > 0 ? (
            <div>
              {filtered.map((faq, i) => (
                <FAQItem key={i} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          ) : (
            <div className='py-12 text-center'>
              <div className='mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted'>
                <SearchX className='size-6 text-muted-foreground' />
              </div>
              <p className='font-medium'>No matching questions</p>
              <p className='text-sm text-muted-foreground'>Try a different keyword.</p>
            </div>
          )}
        </div>

        {/* Still have questions? */}
        <div className='mt-12 rounded-2xl border border-border bg-muted/50 p-10 text-center'>
          <h3 className='font-manrope text-xl font-semibold tracking-tight mb-4'>
            Still have questions?
          </h3>
          <p className='text-muted-foreground mb-8'>
            If you couldn&rsquo;t find the answer you&rsquo;re looking for,
            please contact our support team.
          </p>
          <Button asChild>
            <Link to='/contact'>Contact Support</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
