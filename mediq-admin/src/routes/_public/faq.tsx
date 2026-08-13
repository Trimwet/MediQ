import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, HelpCircle, ChevronDown } from 'lucide-react'
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
        className='w-full py-6 flex items-center justify-between text-left group'
      >
        <span
          className={cn(
            'text-lg font-semibold transition-colors',
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
        <p className='pb-6 text-muted-foreground leading-relaxed'>{answer}</p>
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
      <section className='bg-primary/10 py-24 text-center relative overflow-hidden'>
        <div className='absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2' />
        <div className='relative z-10 mx-auto max-w-6xl px-4 sm:px-6'>
          <div className='mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/20 backdrop-blur-md'>
            <HelpCircle className='size-8 text-primary' />
          </div>
          <h1 className='font-manrope text-4xl font-bold tracking-tight mb-6 sm:text-5xl'>
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
        <div className='relative mb-12'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground' />
          <Input
            placeholder='Search for questions...'
            className='pl-12 py-4 rounded-xl bg-card shadow-lg border-border'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* FAQ List */}
        <div className='rounded-xl border border-border bg-card p-8 shadow-sm md:p-12'>
          {filtered.length > 0 ? (
            <div>
              {filtered.map((faq, i) => (
                <FAQItem key={i} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          ) : (
            <div className='py-10 text-center'>
              <p className='text-muted-foreground'>No matching questions found.</p>
            </div>
          )}
        </div>

        {/* Still have questions? */}
        <div className='mt-16 text-center'>
          <h3 className='font-manrope text-xl font-bold tracking-tight mb-4'>
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
