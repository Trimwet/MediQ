# Staff Offline Mode for MediQ: Deep Research Report

**Date:** 2026-08-21
**Researcher:** Tares (Orgle Collective) — direct research (Wayne unavailable)
**Target:** React/Vite + Supabase clinic app (MediQ) — staff continuity during 2-5 min network hiccups
**Goal:** Staff (admin, front_desk, doctor) can still view appointments, update statuses, and manage the queue while offline; changes sync automatically when connectivity returns.

---

## Executive Summary

- **Problem:** A 2-minute WiFi dropout currently shuts down the entire clinic — no reads, no writes, no queue management.
- **Solution:** Local-first staff mode — IndexedDB (Dexie.js) as primary read source, durable outbox queue for writes, service worker for app shell + fallback sync.
- **Architecture:** `local writes → IndexedDB → outbox queue → replay to Supabase on reconnect`. Reads always hit local DB first (TanStack Query with `persistQueryClient` + Dexie persister).
- **Conflict model:** Server-authoritative with optimistic locking (`version`/`updated_at` check). Most staff writes are safe for last-write-wins (status transitions); queue operations need ordered replay.
- **Auth:** Supabase JWT persisted in IndexedDB (not just localStorage) so service worker can access it; refresh on `visibilitychange` + `online` event.
- **MVP scope:** View appointments/queue/patients, update appointment status, queue callNext/startVisit/complete — all offline-capable. Admin-only writes (doctors/staff/rooms CRUD) stay online-only.

---

## 1. Staff Data Access Patterns (from codebase audit)

### Source files
- `src/config/rbac.ts` — 4 roles, 17 permissions
- `src/data/supabase/repos.ts` — 8 repositories (appointments, queue, patients, doctors, staff, rooms, notifications, booking)
- `src/data/hooks.ts` — TanStack Query hooks wrapping all repos
- `supabase/migrations/20260819113813_init.sql` — 10 enums, 9 tables, RLS policies

### Role → Data Access Matrix

| Table | admin | front_desk | doctor | Patient? | Pattern |
|-------|-------|------------|--------|----------|---------|
| **appointments** | Full CRUD | Full CRUD | View + filtered (own only via `doctor.user_id` match) | Own only (email match) | Read-heavy, write on status changes |
| **queue_entries** | Full CRUD | Full CRUD | Read (filtered to own) | — | Real-time, high write churn |
| **patients** | Full | Full | View (filtered to own appointments) | — | Read-heavy |
| **doctors** | Full CRUD | Read | Read | — | Mostly static |
| **staff** | Full CRUD | Read | Read | — | Mostly static |
| **rooms** | Full CRUD | Read | Read | — | Mostly static + occupancy via queue join |
| **notifications** | Full | Read | Read | Own only | Read-heavy |
| **profiles** | Own or admin | Own | Own | Own | Rare writes |

### Key findings

1. **Write-hot tables for offline:** `appointments` (status updates: `pending→booked→arrived→in_progress→completed/cancelled/rejected`), `queue_entries` (status: `waiting→called→in_room→done/left`, plus `callNext` which is a read-then-write).
2. **Read-hot / mostly static:** `doctors`, `staff`, `rooms`, `patients` — safe to cache aggressively. Doctor list rarely changes mid-day.
3. **`queue_entries.callNext` is a race-sensitive read-then-write:** Finds the earliest `waiting` entry, then updates it to `called`. Offline, two staff members could call different "next" patients. Server must be authoritative — replay in creation order with validation.
4. **Doctor filtering is client-side** in `useQueue` and `usePatients` (filters after fetching all rows). RLS also scopes server-side, but offline the local DB must replicate the filtering logic.
5. **Optimistic updates already exist** in `hooks.ts` for `useUpdateAppointmentStatus`, `useApproveAppointment`, `useRejectAppointment` — the UI already patches the cache before the network responds. Offline mode extends this: the patch stays local until sync.

### Offline Priority Ranking

| Priority | Tables | Why |
|----------|--------|-----|
| **P0 — must work offline** | appointments, queue_entries | Clinic cannot function without these |
| **P1 — should work offline** | patients, doctors (read) | Needed to display appointment context |
| **P2 — nice to have offline** | rooms | Occupancy display |
| **P3 — online only** | staff/doctor/room CRUD, notifications | Admin operations, not urgent during hiccup |

---

## 2. Supabase Offline Data Fetching

### Search Queries
- `supabase offline mode local cache stale while revalidate`
- `supabase offline pwa`
- `supabase react query persist offline`

### Key Findings

| Source | Finding |
|--------|---------|
| [PowerSync — Offline-First to Supabase](https://powersync.com/blog/bringing-offline-first-to-supabase) | Offline-first means treating local DB as primary, not cache-as-fallback. Cache-as-fallback (online-first with stale fallback) has problems: stale data, LRU eviction, slow fallback on intermittent connectivity. True offline-first keeps data scoped and persisted indefinitely. |
| [Supabase Community Discussion #357](https://github.com/orgs/supabase/discussions/357) | Supabase has **no native offline support** (since 2021). No built-in local cache. Community solutions: PowerSync (managed, WAL-based), ElectricSQL (CRDT), or custom Dexie.js + sync engine. |
| [supabase-cache-helpers RFC #667](https://github.com/psteinroe/supabase-cache-helpers/issues/667) | Cache helpers are **not** offline-first — they do smart revalidation, not durable offline writes. The maintainer explicitly removed offline mutation magic, recommending TanStack DB for real offline. |
| [CARE Platform GSoC 2025](https://gist.github.com/Vikaspal8923/9072b2f9375242755b3ed23c8b205515) | Real medical app (CARE) solved this with TanStack Query `persistQueryClient` + Dexie.js + `meta: { persist: true }` on queries. Only offline-relevant queries are persisted. Manual mutation queue with normalized payloads. |
| [Next.js + Supabase Offline-First](https://www.iloveblogs.blog/post/building-offline-first-nextjs-supabase) | Pattern: `localStorageManager` + `SyncEngine` class with `queueChange()` / `sync()` / `fetchLatestData()`. Uses `navigator.onLine` + `online` event. Simple but no Dexie — suitable for small apps only. |

### Practical Recommendation for MediQ

**Do NOT use a cache-as-fallback strategy** (try network first, fall back to cache). Instead:

1. **Persist TanStack Query cache to IndexedDB** via `@tanstack/query-persist-client` + Dexie persister. Mark staff-critical queries with `meta: { persist: true }`.
2. **Dexie.js as the durable store** for the offline write queue (outbox pattern), not just query cache. The outbox survives page refreshes and browser restarts — `localStorage` does not reliably.
3. **Reads hit local DB first** when offline; writes go to outbox queue + optimistic local patch.

```typescript
// Example: Persist only staff-critical queries
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createPersister } from './lib/queryPersister' // Dexie-backed

persistQueryClient({
  queryClient,
  persister: createPersister(),
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.meta?.persist === true,
  },
})

// In hooks.ts:
useQuery({
  queryKey: ['appointments', clinicId],
  queryFn: () => appointmentsRepository.list(clinicId),
  meta: { persist: true }, // ← cached to IndexedDB
})
```

---

## 3. Queue Management Offline

### The Problem
`queue_entries.callNext` is a **read-then-write**: find the earliest `waiting` entry, update it to `called`. Offline, this is non-deterministic — two staff members see the same "next" patient.

### Search: `offline queue management conflict resolution`

| Source | Finding |
|--------|---------|
| [MicroItinerary — Offline-First PWA](https://rohitraj.tech/en/notes/pwa-offline-sync) | Last-write-wins for simple status toggles; manual resolution for same-field conflicts. Queue operations are ordered — must replay in creation order. |
| [Back4app — Offline-First Data Sync](https://www.back4app.com/glossary/offline-first-data-sync/) | Outbox queue replays in order. Operations should be idempotent — replaying "set status to done" twice is harmless; replaying "increment" twice is a bug. Queue operations are idempotent (set status). |

### Recommendation for MediQ Queue

1. **Outbox stores intent, not just state:** `{ type: 'queue.callNext', payload: { doctorName, queuedAt, idempotencyKey } }` — not just the resulting status change.
2. **Server validates on replay:** When draining, the server checks if the queue entry is still `waiting` before transitioning to `called`. If another staff member already called it, the server returns a conflict (409) and the client refreshes its local queue.
3. **Ordered replay:** Queue the `callNext` intent; on sync, re-execute the "find earliest waiting" logic server-side (not just replay the status update for a specific ID). This ensures correctness even if the queue changed while offline.
4. **UI during offline:** Show the optimistic result immediately (patient moves to "called"), with a "pending sync" indicator. On conflict, show a toast: "Queue changed while offline — refreshed."

```typescript
// Outbox entry for queue
type QueueOutboxEntry = {
  id: string // crypto.randomUUID() — idempotency key
  type: 'queue.callNext' | 'queue.startVisit' | 'queue.complete' | 'queue.markLeft'
  payload: { entryId?: string; doctorName?: string; clinicId: string }
  createdAt: number
  attempts: number
  status: 'pending' | 'syncing' | 'failed'
}
```

---

## 4. Status Update Conflicts

### Scenario
Doctor marks appointment "completed" offline; front desk marks the same appointment "cancelled" offline; both come online.

### Valid Status Transitions (from `appointment_status` enum)

```
pending → booked → arrived → in_progress → completed
pending → rejected (admin/front_desk)
booked → cancelled
any → no_show (front_desk)
```

Only `admin`/`front_desk` can transition most statuses (see RLS: `appointments_update_roles` requires `is_admin() OR has_role('front_desk')`). Doctors **cannot** update appointment status at all via RLS — they can only view. So the conflict is between two front_desk/admin users, not doctor vs. front_desk.

### Resolution Strategies

| Strategy | How | Right for |
|----------|-----|-----------|
| **Last-write-wins (server receipt time)** | Newest `updated_at` wins | Low-stakes toggles, single-writer |
| **Reject stale with 409** | Server checks `baseVersion` (the `updated_at` the client saw) — if server version advanced, reject | Staff status updates where losing an edit matters |
| **Field-level merge** | If two offline edits touched different fields, merge | Forms with many fields |
| **Manual resolution UI** | Show both versions, let user pick | High-stakes records |

### Recommendation for MediQ

**Optimistic locking with `updated_at` version check** — the simplest correct approach for appointment status:

1. When queuing an offline status update, store `baseVersion: appointment.updated_at` (the timestamp the client last saw).
2. On replay, server does: `UPDATE appointments SET status = $newStatus WHERE id = $id AND updated_at = $baseVersion`. If 0 rows affected → conflict (someone else updated it).
3. On conflict: fetch the server's current record, show a non-blocking notification ("Appointment was updated by another user — please review"), and refresh the local cache.

For a 2-5 minute hiccup, conflicts will be rare (two people editing the same appointment in the same 2 minutes). Last-write-wins would also be acceptable for this short window, but optimistic locking prevents silent data loss.

```typescript
// Server-side (in the replay handler)
const result = await supabase
  .from('appointments')
  .update({ status: newStatus, updated_at: new Date().toISOString() })
  .eq('id', appointmentId)
  .eq('updated_at', baseVersion) // ← optimistic lock
  .select()

if (result.data?.length === 0) {
  // Conflict — someone else updated it
  return { status: 409, serverRecord: await fetchCurrent(appointmentId) }
}
```

---

## 5. Offline Auth / Session Persistence

### Search Queries
- `supabase auth offline JWT persistence refresh token`
- `supabase offline session persistence`

### Key Findings

| Source | Finding |
|--------|---------|
| [Supabase Docs — User Sessions](https://supabase.com/docs/guides/auth/sessions) | Access tokens are short-lived (5 min – 1 hour, configurable). Refresh tokens never expire but can only be used once. Supabase auto-refreshes before expiry when `autoRefreshToken: true`. |
| [Supabase JS — createClient options](https://supabase.com/docs/reference/javascript/initializing) | `auth.persistSession: true` (default) stores session in `localStorage`. Custom storage can be provided (e.g., IndexedDB for service worker access). |
| [GitHub Issue #226 — Token refresh offline](https://github.com/supabase/auth-js/issues/226) | Token refresh fails silently when offline and never recovers — fixed in `auth-js` v1.22.14+ with retry on `visibilitychange`. |
| [Care Platform — Device Tokens](https://gist.github.com/Vikaspal8923/9072b2f9375242755b3ed23c8b205515) | For offline healthcare, consider device tokens (long-lived) as supplement to JWT, but this adds complexity. |

### Recommendation for MediQ Staff Offline

**For a 2-5 minute hiccup, standard Supabase session persistence is sufficient:**

1. **JWT lifetime:** Check your Supabase project settings — default is 3600s (1 hour). A 2-5 minute offline window will NOT cause JWT expiry. Staff remain authenticated throughout.
2. **Storage:** Supabase stores the session in `localStorage` by default. This survives offline periods and page refreshes. No change needed for short hiccups.
3. **Refresh after reconnect:** The `auth-js` library (v1.22.14+) already handles the "offline during refresh" case — it retries on `visibilitychange` / `online` event. Verify your `@supabase/supabase-js` version is recent.
4. **Service worker auth:** If the service worker needs to make authenticated requests during background sync, it cannot access `localStorage` — only IndexedDB. Solution: also store the session in IndexedDB via a custom `auth.storage` adapter, or have the main thread pass the token to the SW via `postMessage`.

```typescript
// Custom storage that writes to both localStorage and IndexedDB
// so the service worker can read the session
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key, {
  auth: {
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => {
        localStorage.setItem(key, value)
        // Also persist to IndexedDB for SW access
        indexedDB.open('auth-store').onsuccess = (e) => {
          const db = e.target.result
          db.transaction('sessions', 'readwrite')
            .objectStore('sessions').put({ key, value })
        }
      },
      removeItem: (key) => localStorage.removeItem(key),
    },
  },
})
```

**For longer offline periods (30+ min):** Consider extending JWT expiry to 2-4 hours in Supabase Auth settings, or implementing a "stay signed in" device token. For the 2-5 min hiccup use case, this is unnecessary.

---

## 6. Staff UI Offline Indicators

### Search: `offline indicator UX patterns sync status UI`

| Pattern | When to use |
|---------|-------------|
| **Top banner** ("You're offline — changes will sync when connected") | Persistent, always visible when `!navigator.onLine` |
| **Per-row badge** ("Pending sync" clock icon) | On appointments/queue entries with un-synced local changes |
| **Sync status in header** (green dot / yellow spinner / red exclamation) | Compact, shows overall sync health |
| **Sync queue drawer/page** (like CARE's Sync Status page) | For reviewing pending/failed items |

### Recommendation for MediQ

**Three levels of feedback:**

1. **Global banner** (top of every admin page when offline):
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ 🔴 Offline — you're viewing cached data. Changes will  │
   │    sync automatically when connection returns. [2 pending] │
   └─────────────────────────────────────────────────────────┘
   ```

2. **Per-row indicator** on appointments/queue entries that have local-only changes:
   - `pending` → 🕐 clock icon + "Pending sync" tooltip
   - `syncing` → spinner
   - `failed` → ⚠️ with retry button

3. **Sync queue page** (`/admin/sync-status`) — lists all pending/failed/conflicted items with actions: Retry, Discard, View conflict.

**Staleness indicator:** Show "Last synced: 2 minutes ago" in the header. Data older than 5 minutes gets a subtle "Stale" badge. This is honest without being alarming.

---

## 7. Service Worker Strategy for Staff Data

### The Three-Layer Model (from MicroItinerary research)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Service Worker** | `vite-plugin-pwa` + Workbox | Cache app shell (HTML/CSS/JS), intercept API requests |
| **IndexedDB** | Dexie.js | Structured data (appointments, queue, patients) + outbox queue |
| **Background Sync** | Background Sync API + `online` event fallback | Replay outbox when connectivity returns |

### Cache Strategy per Resource Type

| Resource | Strategy | Why |
|----------|----------|-----|
| App shell (`index.html`, JS, CSS) | `CacheFirst` / precache | Must load offline |
| Staff data API (`/rest/v1/appointments`, `/rest/v1/queue_entries`) | `NetworkFirst` with IndexedDB fallback | Try network, fall back to Dexie cache |
| Static assets (images, fonts) | `CacheFirst` | Rarely change |
| Auth endpoints | `NetworkOnly` | Never cache tokens |

### Recommendation

**Do NOT cache Supabase API responses in the service worker's HTTP cache.** Instead, cache structured data in Dexie.js. The SW handles the app shell; Dexie handles the data. This separation avoids the "stale cache vs. local DB" confusion.

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MediQ',
        short_name: 'MediQ',
        theme_color: '#0d9488',
        background_color: '#ffffff',
        display: 'standalone',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Only precache the app shell — NOT API data
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkOnly', // ← let Dexie + TanStack handle data
            options: {
              backgroundSync: {
                name: 'supabase-queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
        ],
      },
    }),
  ],
})
```

---

## 8. IndexedDB Schema for Staff Offline

### Dexie.js Schema

```typescript
// src/lib/offline/db.ts
import Dexie, { type Table } from 'dexie'

export interface CachedAppointment {
  id: string
  clinic_id: string
  patient_name: string
  patient_email: string | null
  doctor_id: string | null
  doctor_name: string | null
  scheduled_for: string
  status: string
  reason: string | null
  rejection_reason: string | null
  updated_at: string // ← version for optimistic locking
  _localStatus: 'synced' | 'pending' | 'failed'
  _localUpdatedAt: number
}

export interface CachedQueueEntry {
  id: string
  clinic_id: string
  appointment_id: string | null
  patient_name: string
  appointment_time: string
  checked_in_at: string
  called_at: string | null
  doctor_name: string
  room_id: string | null
  status: string
  _localStatus: 'synced' | 'pending' | 'failed'
  _localUpdatedAt: number
}

export interface OutboxEntry {
  id: string // crypto.randomUUID() — idempotency key
  table: 'appointments' | 'queue_entries'
  operation: 'updateStatus' | 'approve' | 'reject' | 'callNext' | 'startVisit' | 'complete' | 'markLeft'
  payload: Record<string, unknown>
  baseVersion: string | null // updated_at the client last saw
  clinicId: string
  createdAt: number
  attempts: number
  lastAttemptAt: number | null
  status: 'pending' | 'syncing' | 'failed' | 'conflicted'
  errorMessage: string | null
}

export class MediQOfflineDB extends Dexie {
  appointments!: Table<CachedAppointment, string>
  queueEntries!: Table<CachedQueueEntry, string>
  patients!: Table<any, string>
  doctors!: Table<any, string>
  outbox!: Table<OutboxEntry, string>

  constructor() {
    super('MediQOfflineDB')
    this.version(1).stores({
      appointments: 'id, clinic_id, status, doctor_id, updated_at',
      queueEntries: 'id, clinic_id, status, doctor_name',
      patients: 'id, clinic_id, email',
      doctors: 'id, clinic_id, email',
      outbox: 'id, table, status, createdAt',
    })
  }
}

export const offlineDB = new MediQOfflineDB()
```

### Outbox Lifecycle

```
1. User taps "Mark as arrived" while offline
   → update IndexedDB `appointments` row (optimistic, _localStatus: 'pending')
   → append to `outbox` table
   → update TanStack Query cache (UI reflects change immediately)
   → show "Pending sync" badge

2. Network returns → `online` event fires
   → drain outbox in creation order (FIFO per entity)
   → for each entry: try Supabase write with baseVersion check
   → on success: delete from outbox, update IndexedDB _localStatus to 'synced'
   → on 409 conflict: mark as 'conflicted', surface to user
   → on network error: increment attempts, exponential backoff, retry

3. Inbound sync (while online)
   → Supabase Realtime already pushes changes
   → additionally, periodic pull of recent changes since last sync
```

---

## 9. Edge Cases & Conflict Resolution

| Edge Case | What happens | Resolution |
|-----------|-------------|------------|
| **Two staff edit same appointment offline** | Both queue status updates with different `baseVersion` | Second replay gets 409 → fetch server state → show "Updated by another user" |
| **Staff A offline, Staff B online edits same record** | Staff B's change is on server; Staff A's outbox has stale `baseVersion` | Same as above — 409 on replay |
| **Queue `callNext` while offline** | Two staff both call "next" → same patient called twice? | Server re-validates: "is this entry still waiting?" on replay. Second call finds no matching entry → no-op + refresh |
| **Offline for 30+ min, many queued writes** | Outbox grows, some writes may be stale (patient already left) | Expiry policy: discard outbox entries older than 24h; validate each write against current server state |
| **JWT expires during offline** | Auth fails on replay | Supabase auto-refreshes on `online`/`visibilitychange` — replay waits for valid session |
| **Browser crash during offline** | Is data lost? | No — IndexedDB survives crashes/restarts. Outbox is durable. |
| **iOS Safari 7-day auto-clear** | IndexedDB wiped after 7 days of no use | Call `navigator.storage.persist()` on first visit; for a 2-5 min hiccup this is irrelevant |

### Why Last-Write-Wins is Acceptable for Short Hiccups

For a 2-5 minute window, the probability of two people editing the same appointment is very low. Even if it happens, the "losing" edit is at most 5 minutes of work — a status toggle. For this use case, a simple last-write-wins (server receipt time) would be acceptable and is trivial to implement. Optimistic locking (409) is more correct but adds UI complexity (conflict resolution screen). **Recommendation: start with last-write-wins, add optimistic locking only if conflicts are observed in practice.**

---

## 10. Minimal Viable Offline Feature Set for Staff

### What keeps a clinic running during a 2-5 minute hiccup?

| Feature | Offline? | Priority | Effort |
|---------|----------|----------|--------|
| **View today's appointments** | ✅ Cached | **P0** | Low |
| **View queue** | ✅ Cached | **P0** | Low |
| **Update appointment status** (arrived, completed, cancelled) | ✅ Queued | **P0** | Medium |
| **Queue: callNext, startVisit, complete, markLeft** | ✅ Queued | **P0** | Medium |
| **View patients/doctors (cached)** | ✅ Cached | **P0** | Low |
| **Create new appointment** | ⚠️ Queued (needs clinic_id) | P1 | Medium |
| **Room status updates** | ⚠️ Could queue | P1 | Low |
| **Staff/doctor/room CRUD** | ❌ Online only | P2 | — |
| **Notifications** | ❌ Online only | P2 | — |
| **Real-time queue position** | ❌ Degraded (cached) | P1 | — |

### What does NOT need offline

- Admin CRUD (staff, doctors, rooms) — not urgent during a hiccup
- Notifications — can wait
- Patient self-service booking — separate concern (see Section 11 of the previous patient-offline report)

---

## 11. Implementation Plan

### Phase 1: Foundation (Week 1) — ~24 hours

| Step | Task | Effort | Deliverable |
|------|------|--------|-------------|
| 1.1 | Install `vite-plugin-pwa` + `dexie` + `dexie-react-hooks` + `@tanstack/query-persist-client-core` | 1h | `package.json` |
| 1.2 | Create `MediQOfflineDB` (Dexie) with `appointments`, `queueEntries`, `patients`, `doctors`, `outbox` tables | 4h | `src/lib/offline/db.ts` |
| 1.3 | Configure `vite-plugin-pwa` (app shell precache, `NetworkOnly` for Supabase API) | 4h | `vite.config.ts` |
| 1.4 | Create `useOnlineStatus` hook (`navigator.onLine` + `online`/`offline` events) | 2h | `src/hooks/useOnlineStatus.ts` |
| 1.5 | Add TanStack Query persister (Dexie-backed) for `meta: { persist: true }` queries | 4h | `src/lib/offline/queryPersister.ts` |
| 1.6 | Add offline banner component + sync status indicator | 3h | `src/components/offline-banner.tsx` |
| 1.7 | Mark staff-critical queries as `persist: true` (appointments, queue, patients, doctors) | 2h | `src/data/hooks.ts` edits |
| 1.8 | Test: go offline in DevTools, verify cached data still renders | 4h | Manual verification |

### Phase 2: Offline Write Queue (Week 2) — ~32 hours

| Step | Task | Effort | Deliverable |
|------|------|--------|-------------|
| 2.1 | Build `useOfflineQueue` hook: `enqueue()`, `pendingCount`, `isSyncing` | 6h | `src/lib/offline/queue.ts` |
| 2.2 | Implement `drainQueue()` — FIFO per entity, ordered replay, idempotency keys | 8h | `src/lib/offline/sync.ts` |
| 2.3 | Wire offline writes: `useUpdateAppointmentStatus`, `useQueueActions` check `isOnline` — if offline, write to Dexie + outbox instead of Supabase | 8h | `src/data/hooks.ts` edits |
| 2.4 | Optimistic updates for offline writes (patch TanStack cache + Dexie) | 4h | Same file |
| 2.5 | Auto-drain on `online` event + `visibilitychange` fallback (for Safari) | 3h | `src/lib/offline/sync.ts` |
| 2.6 | Per-row "Pending sync" badges + global pending count | 3h | UI components |

### Phase 3: Conflict Handling & Hardening (Week 3) — ~20 hours

| Step | Task | Effort | Deliverable |
|------|------|--------|-------------|
| 3.1 | Add `baseVersion` (updated_at) to outbox entries for optimistic locking | 3h | `src/lib/offline/db.ts` + queue logic |
| 3.2 | Server-side: handle 409 conflicts in drain — fetch server state, surface notification | 4h | `src/lib/offline/sync.ts` |
| 3.3 | Exponential backoff for failed syncs (1s → 2s → 4s → 8s, max 30s, max 5 retries) | 3h | Same file |
| 3.4 | Queue `callNext` as intent (re-execute "find earliest waiting" server-side) | 4h | `src/lib/offline/queue.ts` |
| 3.5 | `navigator.storage.persist()` on first visit (iOS protection) | 1h | `src/main.tsx` |
| 3.6 | Sync Status page (`/admin/sync-status`) — pending/failed/conflicted list | 5h | `src/features/sync-status/` |

### Phase 4: Testing & Polish (Week 4) — ~20 hours

| Step | Task | Effort | Deliverable |
|------|------|--------|-------------|
| 4.1 | Manual offline testing: DevTools → Offline → perform all P0 operations → go online → verify sync | 4h | Test report |
| 4.2 | Conflict testing: two browser windows, same appointment, both offline, different edits, reconnect | 3h | Conflict handling verified |
| 4.3 | Playwright E2E: offline queue test (chromium offline simulation) | 4h | `tests/e2e/offline.spec.ts` |
| 4.4 | iOS Safari testing (PWA install, offline, 7-day wipe) | 4h | Cross-platform report |
| 4.5 | Lighthouse PWA audit (score >90) | 1h | Audit report |
| 4.6 | Documentation: offline architecture ADR + runbook | 4h | `docs/OFFLINE_ARCHITECTURE.md` |

### Total: ~96 hours (2.5-3 weeks for 1 engineer)

### New Files (7 + 3 modified)

```
MediQ/
├── src/
│   ├── lib/offline/
│   │   ├── db.ts                    # Dexie database + schema (NEW)
│   │   ├── queryPersister.ts        # TanStack → Dexie persister (NEW)
│   │   ├── queue.ts                 # Outbox enqueue/drain logic (NEW)
│   │   ├── sync.ts                  # drainQueue, retry, conflict handling (NEW)
│   │   └── index.ts                 # Barrel export (NEW)
│   ├── hooks/
│   │   └── useOnlineStatus.ts       # navigator.onLine hook (NEW)
│   ├── components/
│   │   ├── offline-banner.tsx       # Global offline banner (NEW)
│   │   └── sync-status-indicator.tsx # Per-row + header sync badges (NEW)
│   ├── features/sync-status/        # Sync Status page (NEW, Phase 3)
│   ├── data/hooks.ts                # Modified: persist + offline branches
│   └── main.tsx                     # Modified: persist() + PWA registration
├── vite.config.ts                   # Modified: VitePWA plugin
└── docs/OFFLINE_ARCHITECTURE.md     # Architecture decision record (NEW)
```

---

## 12. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Supabase RPC changes break replay | Low | High | Version queue payloads; validate on replay |
| IndexedDB quota exceeded | Very Low | Medium | Booking + queue data is tiny (<1MB for a day) |
| iOS 7-day auto-clear | Low | High | `navigator.storage.persist()`, warn users |
| Background Sync not in Safari | High | Low | `online` event fallback works everywhere |
| Conflict during 2-min hiccup | Very Low | Low | Last-write-wins is acceptable for this window |
| JWT expires during long offline | Very Low | Medium | Auto-refresh on `online` event; extend expiry to 2h if needed |

---

## 13. Key Difference: Staff Offline vs. Patient Offline

| Aspect | Patient booking offline | Staff continuity offline |
|--------|------------------------|--------------------------|
| **Value** | Marginal — 30s form, same queue position | **High — clinic cannot stop** |
| **Data** | Single append (new booking) | Multiple reads + status transitions + queue ops |
| **Conflict risk** | None (append-only, no one else books same slot) | Low but real (two staff same appointment) |
| **Auth** | Anonymous (no auth needed) | Authenticated (JWT, role-gated) |
| **Effort** | ~40h (just booking queue) | ~96h (full staff offline) |
| **Recommendation** | Skip for now | **Build this** |

---

## References

1. [PowerSync — Offline-First to Supabase](https://powersync.com/blog/bringing-offline-first-to-supabase)
2. [Supabase Discussion #357 — Offline Support](https://github.com/orgs/supabase/discussions/357)
3. [MicroItinerary — Offline-First PWA Patterns](https://rohitraj.tech/en/notes/pwa-offline-sync) — Dexie.js + Background Sync, last-write-wins
4. [Back4app — Offline-First Data Sync](https://www.back4app.com/glossary/offline-first-data-sync/) — Buffer vs. replica, per-field conflict strategy
5. [CARE Platform — Offline Data Entry (GSoC 2025)](https://gist.github.com/Vikaspal8923/9072b2f9375242755b3ed23c8b205515) — Real medical app offline (Dexie + TanStack Query persist)
6. [Supabase Docs — User Sessions / JWT](https://supabase.com/docs/guides/auth/sessions)
7. [Dexie.js — SyncState](https://dexie.org/docs/cloud/SyncState)
8. [vite-plugin-pwa — Workbox generateSW](https://github.com/vite-pwa/vite-plugin-pwa/blob/main/docs/workbox/generate-sw.md)
9. [Offline-First Data Sync — error-recovery.com](https://www.error-recovery.com/pwa-offline-recovery-service-worker-resilience/offline-first-data-sync-and-conflict-resolution/) — Version vectors, baseVersion pattern
10. [DataRX Frontend — Dexie.js clinic offline](https://github.com/sadatcse/DataRX-Frontend) — Clinic management with Dexie + syncQueue

---

*Report written directly by Tares after parallel codebase audit + 8 web searches. No subagent involved per user request. All code references verified against the MediQ repo at commit `ab16d90`.*
