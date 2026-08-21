/**
 * Determines whether an appointment is eligible for check-in.
 *
 * Terminal / non-actionable statuses are blocked. All other statuses
 * (booked, pending, arrived, in_progress) allow check-in.
 */
export function canCheckIn(apt: { status: string }): boolean {
  return !['completed', 'cancelled', 'rejected', 'no_show', 'done'].includes(
    apt.status
  )
}
