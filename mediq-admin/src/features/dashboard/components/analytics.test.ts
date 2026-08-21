import { describe, it, expect } from 'vitest'
import { aggregateByStatus, calcAvgWaitMinutes } from './analytics-helpers'

describe('aggregateByStatus', () => {
  it('counts by status', () => {
    const rows = [
      { status: 'booked' },
      { status: 'completed' },
      { status: 'booked' },
    ] as any[]
    expect(aggregateByStatus(rows)).toEqual([
      { name: 'booked', value: 2 },
      { name: 'completed', value: 1 },
    ])
  })
})

describe('calcAvgWaitMinutes', () => {
  it('averages done queue entries', () => {
    const entries = [
      {
        checked_in_at: '2026-08-20T10:00:00Z',
        called_at: '2026-08-20T10:20:00Z',
        status: 'done',
      },
      {
        checked_in_at: '2026-08-20T11:00:00Z',
        called_at: '2026-08-20T11:10:00Z',
        status: 'done',
      },
    ] as any[]
    expect(calcAvgWaitMinutes(entries)).toBe(15)
  })
})
