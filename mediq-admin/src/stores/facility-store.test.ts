import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importFacilityStore() {
  const { useFacilityStore, formatRoom, inStageLabel } =
    await import('./facility-store')
  return { useFacilityStore, formatRoom, inStageLabel }
}

describe('useFacilityStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('defaults to tracking rooms with the "Room" label', async () => {
    const { useFacilityStore } = await importFacilityStore()

    expect(useFacilityStore.getState().trackRooms).toBe(true)
    expect(useFacilityStore.getState().roomLabel).toBe('Room')
  })

  it('persists facility settings so a new store instance reads them back', async () => {
    const { useFacilityStore } = await importFacilityStore()
    useFacilityStore.getState().setTrackRooms(false)
    useFacilityStore.getState().setRoomLabel('Office')

    vi.resetModules()
    const { useFacilityStore: reloaded } = await importFacilityStore()

    expect(reloaded.getState().trackRooms).toBe(false)
    expect(reloaded.getState().roomLabel).toBe('Office')
  })

  it('falls back to "Room" when an empty label is set', async () => {
    const { useFacilityStore } = await importFacilityStore()

    useFacilityStore.getState().setRoomLabel('   ')

    expect(useFacilityStore.getState().roomLabel).toBe('Room')
  })

  it('formats room identifiers with the active label', async () => {
    const { formatRoom } = await importFacilityStore()

    expect(formatRoom('2')).toBe('Room 2')
    expect(formatRoom('2', 'Office')).toBe('Office 2')
    expect(formatRoom(undefined, 'Office')).toBe('Office not set')
  })

  it('derives the serving stage label from the settings', async () => {
    const { inStageLabel } = await importFacilityStore()

    expect(inStageLabel(true)).toBe('In room')
    expect(inStageLabel(true, 'Office')).toBe('In office')
    expect(inStageLabel(false)).toBe('In consultation')
  })
})
