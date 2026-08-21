/**
 * Pure aggregation helpers for the analytics dashboard.
 *
 * These are deliberately decoupled from Supabase so they can be unit-tested
 * without any database or network dependency.
 */

/**
 * Count appointments by status.
 *
 * @example
 * aggregateByStatus([{ status: 'booked' }, { status: 'completed' }, { status: 'booked' }])
 * // => [{ name: 'booked', value: 2 }, { name: 'completed', value: 1 }]
 */
export function aggregateByStatus(
  rows: Array<{ status: string }>,
): Array<{ name: string; value: number }> {
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.status, (map.get(r.status) ?? 0) + 1)
  return [...map.entries()].map(([name, value]) => ({ name, value }))
}

/**
 * Average wait in minutes for queue entries that have been called ("done").
 *
 * Returns `null` when there are no completed entries to average.
 *
 * @example
 * calcAvgWaitMinutes([
 *   { checked_in_at: '2026-08-20T10:00:00Z', called_at: '2026-08-20T10:20:00Z', status: 'done' },
 *   { checked_in_at: '2026-08-20T11:00:00Z', called_at: '2026-08-20T11:10:00Z', status: 'done' },
 * ])
 * // => 15
 */
export function calcAvgWaitMinutes(
  entries: Array<{
    checked_in_at: string
    called_at: string | null
    status: string
  }>,
): number | null {
  const done = entries.filter((e) => e.called_at && e.status === 'done')
  if (!done.length) return null
  const mins = done.map(
    (e) =>
      (new Date(e.called_at!).getTime() - new Date(e.checked_in_at).getTime()) /
      60000,
  )
  return Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)
}
