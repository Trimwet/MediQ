import { describe, expect, it } from 'vitest'
import { canCheckIn } from './helpers'

describe('canCheckIn', () => {
  it('allows check-in for booked appointments', () => {
    expect(canCheckIn({ status: 'booked' })).toBe(true)
  })

  it('blocks check-in for completed appointments', () => {
    expect(canCheckIn({ status: 'completed' })).toBe(false)
  })

  it('blocks check-in for cancelled appointments', () => {
    expect(canCheckIn({ status: 'cancelled' })).toBe(false)
  })

  it('blocks check-in for rejected appointments', () => {
    expect(canCheckIn({ status: 'rejected' })).toBe(false)
  })

  it('blocks check-in for no_show appointments', () => {
    expect(canCheckIn({ status: 'no_show' })).toBe(false)
  })

  it('allows check-in for pending appointments', () => {
    expect(canCheckIn({ status: 'pending' })).toBe(true)
  })

  it('allows check-in for arrived appointments', () => {
    expect(canCheckIn({ status: 'arrived' })).toBe(true)
  })
})
