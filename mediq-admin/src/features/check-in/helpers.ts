/**
 * Determines whether an appointment is eligible for check-in.
 *
 * Only `booked` (approved) and `arrived` (already checked-in once) are
 * allowed. `pending` requires staff approval first.
 */
export function canCheckIn(apt: { status: string }): boolean {
  return ['booked', 'arrived'].includes(apt.status)
}

/**
 * Returns true when the appointment exists but cannot be checked in
 * because it is awaiting staff approval.
 */
export function isPendingApproval(apt: { status: string }): boolean {
  return apt.status === 'pending'
}
