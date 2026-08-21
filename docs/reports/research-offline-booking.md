# Offline Appointment Booking for MediQ: Deep Research Report

**Date:** 2026-08-21  
**Researcher:** Wayne (Orgle Collective)  
**Target:** React/Vite + Supabase medical clinic app (MediQ)

---

## Executive Summary

- **Supabase has no native offline support** — use ElectricSQL, PowerSync, or custom Dexie.js queue
- **Background Sync is Chromium-only** (76.7% global) — mandatory `online` event fallback for Safari/Firefox
- **Dexie.js is the best IndexedDB wrapper** for offline-first: typed queries, React hooks (`useLiveQuery`), schema migrations
- **Idempotency keys + LWW conflict resolution** handle duplicate submissions for append-only bookings
- **Medical apps require AES-256 at rest, TLS 1.3 in transit, immutable audit logs (6+ years)**
- **Minimal viable offline feature set:** booking form submission only — no real-time queue, no availability checks, no auth

---

## 1. Supabase Offline Patterns

### Search Queries
- `supabase offline pwa`
- `supabase offline first`
- `supabase background sync`
- `supabase electric-sql`

### Key Findings

| Source | Finding |
|--------|---------|
| [Supabase Partners - ElectricSQL](https://supabase.com/partners/integrations/electricsql) | ElectricSQL is the official Supabase partner for local-first sync. Provides conflict-free CRDT-based sync, partial replication via "Shapes", native Supabase Auth integration. |
| [Supascale Blog - Offline-First with Self-Hosted Supabase](https://www.supascale.app/blog/building-offlinefirst-apps-with-selfhosted-supabase) | Three options: PowerSync (managed, mature mobile SDKs), ElectricSQL (open-source, self-hosted, CRDT), WatermelonDB (DIY). PowerSync + Supabase is "the real local-first stack". |
| [John Apollos Olal - Medium](https://johnapollosolal.medium.com/how-i-built-an-offline-first-pwa-with-supabase-and-dexie-js-and-why-it-was-harder-than-i-expected-8e14575fc412) | Real production example: BaseOps logistics PWA. Uses Next.js + Supabase + Dexie.js + Service Worker. Mutation queue in IndexedDB, background flush on interval + `navigator.onLine`. |
| [GitHub Discussion #357](https://github.com/orgs/supabase/discussions/357) | Supabase has no first-party offline support since 2021. Community recommends ElectricSQL, PowerSync, or custom solutions. |
| [ElectricSQL PGlite](https://electric.ax/sync/pglite) | PGlite: WASM Postgres in browser (~3MB gzipped). Can run full Postgres locally with Electric sync. |

### Practical Recommendation

**For MediQ (React/Vite web app):** Use **Dexie.js + custom sync engine** rather than ElectricSQL/PowerSync because:
- ElectricSQL requires running a separate sync service (adds infrastructure complexity)
- PowerSync is managed but adds cost and vendor lock-in
- Dexie.js is lightweight (65KB), has React hooks (`useLiveQuery`), and works with existing Supabase RPC calls
- Appointments are append-only (simpler conflict model than collaborative editing)

---

## 2. PWA + Workbox for Vite

### Search Queries
- `vite-plugin-pwa`
- `vite pwa workbox background sync`
- `vite-plugin-pwa background sync configuration`

### Key Findings

| Source | Finding |
|--------|---------|
| [vite-plugin-pwa GitHub](https://github.com/vite-pwa/vite-plugin-pwa) | Zero-config PWA for Vite. Supports `generateSW` (default) and `injectManifest` modes. Workbox v7, requires Node 16+. |
| [Issue #739 - Background Sync Not Working](https://github.com/vite-pwa/vite-plugin-pwa/issues/739) | Background Sync in Workbox requires: unique `name` per HTTP method, `forceSyncFallback: true` for dev server testing, `navigateFallbackDenylist` to exclude `/api/` from precache handler. Firefox doesn't support Background Sync API at all. |
| [ASOasis Tutorial](https://asoasis.tech/articles/2026-03-29-1453-react-progressive-web-app-tutorial) | Complete Vite + React + Workbox config example. `registerType: 'autoUpdate'`, `navigateFallback: '/index.html'`, `runtimeCaching` for images (CacheFirst) and APIs (StaleWhileRevalidate). |
| [Workbox BackgroundSyncPlugin](https://developers.google.com/web/tools/workbox/modules/workbox-background-sync) | `BackgroundSyncPlugin(queueName, { maxRetentionTime: 24*60 })` queues failed POST requests. Only retries on network failure (not 4xx/5xx). |

### Recommended Manifest Config for Medical App

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'MediQ - Medical Appointment Booking',
        short_name: 'MediQ',
        description: 'Book medical appointments offline-first',
        theme_color: '#0d9488', // teal-600
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        categories: ['medical', 'health'],
        prefer_related_applications: false
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 60, maxAgeSeconds: 30*24*60*60 } }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: { 
              cacheName: 'api',
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
              // Background Sync for booking mutations
              plugins: [
                // Custom plugin needed for BackgroundSyncPlugin with unique names per method
              ]
            }
          }
        ]
      }
    })
  ]
})
```

### Practical Recommendation

Use `vite-plugin-pwa` with `injectManifest` mode for full control over service worker. Configure **two separate BackgroundSync queues** (one for POST, one for PUT/PATCH) with unique names. Add `forceSyncFallback: true` for development testing. Exclude `/api/*` from precache via `navigateFallbackDenylist`.

---

## 3. IndexedDB for Booking Queue

### Search Queries
- `dexie.js offline queue`
- `indexeddb offline first react`
- `dexie vs idb vs localforage`

### Key Findings

| Feature | Dexie.js | idb | localForage |
|---------|----------|-----|-------------|
| **API Style** | ORM-like, typed tables | Raw IndexedDB (promisified) | Key-value |
| **Query/Filtering** | ✅ Rich queries, indexes | ✅ Via IDBKeyRange | ❌ Get by key only |
| **React Hooks** | ✅ `useLiveQuery` (dexie-react-hooks) | ❌ | ❌ |
| **Schema Migrations** | ✅ Built-in versioning | ✅ Manual | ❌ |
| **Transactions** | ✅ Full support | ✅ Full support | ❌ |
| **Bundle Size** | ~65KB | ~3KB | ~15KB |
| **Downloads/week (2026)** | 1.5M | 20M | 7.4M |

### Sources
- [PkgPulse 2026 Comparison](https://www.pkgpulse.com/guides/dexie-vs-localforage-vs-idb-indexeddb-browser-storage-2026) — Dexie.js "best default for app-like IndexedDB data"
- [WellAlly Tutorial](https://www.wellally.tech/blog/build-offline-pwa-react-dexie-workbox) — Health tracking PWA with Dexie + Workbox Background Sync
- [Dexie.js Docs](https://dexie.org/docs) — Complete API, React hooks, sync guides

### Practical Recommendation

**Use Dexie.js** for MediQ because:
1. `useLiveQuery` makes IndexedDB the single source of truth — UI re-renders automatically when queue changes
2. Built-in schema migrations handle version upgrades for offline users
3. Rich queries needed for: "show pending bookings", "filter by date", "count unsynced"
4. Transaction support ensures booking + queue entry are atomic
5. TypeScript-first with full type inference

**Queue Schema:**
```typescript
// src/lib/db.ts
import Dexie, { Table } from 'dexie'

export interface QueuedBooking {
  id?: number
  idempotencyKey: string        // UUID generated on client
  payload: BookingFormData      // Full booking form data
  createdAt: number             // Date.now()
  attempts: number              // Retry count
  lastAttemptAt?: number
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  error?: string
}

export class MediQDB extends Dexie {
  queuedBookings!: Table<QueuedBooking>
  
  constructor() {
    super('mediq-offline-db')
    this.version(1).stores({
      queuedBookings: '++id, idempotencyKey, createdAt, status'
    })
  }
}

export const db = new MediQDB()
```

---

## 4. Background Sync API

### Search Queries
- `background sync api browser support 2026`
- `periodic background sync browser support`
- `background sync fallback navigator.onLine`

### Key Findings

| Browser | One-off Background Sync | Periodic Background Sync |
|---------|------------------------|-------------------------|
| Chrome 49+ | ✅ Full support | ✅ (requires permission) |
| Edge 79+ | ✅ Full support | ✅ |
| Opera 42+ | ✅ Full support | ✅ |
| Samsung Internet | ✅ One-shot only | ❌ |
| Firefox | ❌ Not supported | ❌ |
| Safari (macOS/iOS) | ❌ Not supported | ❌ |
| Android WebView | ❌ Not supported | ❌ |

**Global Support:** 76.73% (Chromium-based only) — [caniuse.com](https://caniuse.com/background-sync)

### Fallback Strategy (Mandatory)

```typescript
// src/lib/sync.ts
async function requestSync() {
  // Try Background Sync first (Chromium)
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.sync.register('mediq-booking-sync')
      return // Success — browser will fire sync event when online
    } catch {
      // Fall through to fallback
    }
  }
  
  // Fallback: online event + page load flush (works everywhere)
  flushQueue()
}

// Fallback listeners
window.addEventListener('online', flushQueue)
window.addEventListener('load', flushQueue)
```

### Service Worker Sync Handler

```typescript
// public/sw.js (injectManifest mode)
self.addEventListener('sync', (event) => {
  if (event.tag === 'mediq-booking-sync') {
    event.waitUntil(flushBookingQueue())
  }
})

async function flushBookingQueue() {
  const db = await openDB() // Dexie or idb
  const pending = await db.queuedBookings
    .where('status').equals('pending')
    .toArray()
  
  for (const booking of pending) {
    try {
      await db.queuedBookings.update(booking.id, { status: 'syncing', lastAttemptAt: Date.now() })
      
      const res = await fetch('/api/book-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': booking.idempotencyKey
        },
        body: JSON.stringify(booking.payload)
      })
      
      if (res.ok) {
        await db.queuedBookings.update(booking.id, { status: 'synced' })
      } else if (res.status >= 500) {
        throw new Error(`Server error: ${res.status}`)
      } else {
        // 4xx = don't retry (validation error, conflict)
        await db.queuedBookings.update(booking.id, { status: 'failed', error: await res.text() })
      }
    } catch (err) {
      // Network error — will retry on next sync event
      await db.queuedBookings.update(booking.id, { 
        status: 'pending', 
        attempts: booking.attempts + 1,
        error: err.message 
      })
      throw err // Throw to keep Background Sync registration alive
    }
  }
}
```

### Practical Recommendation

**Register Background Sync first, fall back to `online` event.** This gives Chromium users true background sync (works even with tab closed) while providing universal coverage. **Do not use Periodic Background Sync** — it's experimental, requires user permission, and fires only ~every 12h on Wi-Fi+charging.

---

## 5. Conflict Resolution for Append-Only Bookings

### Search Queries
- `offline first conflict resolution deduplication append only booking`
- `idempotency key background sync duplicate prevention`

### Key Findings

| Source | Finding |
|--------|---------|
| [OpenReplay - Offline Form Submission](https://blog.openreplay.com/offline-form-submission-background-sync) | **Idempotency-Key header** prevents duplicates. Server must deduplicate on `Idempotency-Key`. Workbox BackgroundSyncPlugin only retries on network failure, not 4xx/5xx. |
| [ArchMan - Offline Sync](https://archman.dev/docs/frontend-and-mobile-architecture/mobile-architecture/offline-sync-and-conflict-resolution) | Write queue pattern with idempotent operations. LWW (Last-Write-Wins) by timestamp for simple data. |
| [Agaro Field Notes](https://agaro.ai/blog/offline-first-mobile-sync) | Conflict resolution per record type. LWW works for state, fails for counters. Audit trails must survive round-trip. |
| [Immharsh Offline-First Sync Queue](https://github.com/immharsh/Offline-first-Sync-Queue) | Flutter example: idempotency keys + LWW by `updatedAtMillis`. Unit tests for idempotency. |

### Conflict Scenarios for MediQ Bookings

| Scenario | Risk | Mitigation |
|----------|------|------------|
| User submits offline, comes online, submits again (double-click) | Duplicate booking | **Idempotency-Key** (client-generated UUID) — server rejects duplicate |
| User books same slot on two devices offline | Double-booking | **Server-side slot locking** in `book_appointment` RPC |
| Network timeout, request actually succeeded | Duplicate on retry | Idempotency-Key + server deduplication |
| Two family members book for same patient | Business logic conflict | Server validation in RPC (patient can't have overlapping appointments) |

### Recommended Implementation

**Client-side:**
```typescript
// Generate once per booking attempt
const idempotencyKey = crypto.randomUUID()

// Store in queue with idempotencyKey
await db.queuedBookings.add({
  idempotencyKey,
  payload: formData,
  createdAt: Date.now(),
  attempts: 0,
  status: 'pending'
})
```

**Server-side (Supabase RPC):**
```sql
CREATE OR REPLACE FUNCTION book_appointment(
  p_patient_id uuid,
  p_doctor_id uuid,
  p_slot_id uuid,
  p_idempotency_key text  -- NEW: required parameter
) RETURNS uuid AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  -- Check for existing booking with same idempotency key
  SELECT id INTO v_booking_id 
  FROM appointments 
  WHERE idempotency_key = p_idempotency_key;
  
  IF v_booking_id IS NOT NULL THEN
    RETURN v_booking_id;  -- Already booked, return existing
  END IF;
  
  -- Verify slot availability (row-level lock)
  SELECT id INTO v_booking_id
  FROM appointment_slots
  WHERE id = p_slot_id AND is_available = true
  FOR UPDATE SKIP LOCKED;
  
  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Slot no longer available';
  END IF;
  
  -- Create booking
  INSERT INTO appointments (patient_id, doctor_id, slot_id, idempotency_key, status)
  VALUES (p_patient_id, p_doctor_id, p_slot_id, p_idempotency_key, 'confirmed')
  RETURNING id INTO v_booking_id;
  
  -- Mark slot as taken
  UPDATE appointment_slots SET is_available = false WHERE id = p_slot_id;
  
  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. Medical/Healthcare Offline Patterns

### Search Queries
- `healthcare app offline mode`
- `clinic management offline pwa`
- `hipaa data at rest encryption audit trail`

### Key Findings

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| **Data at rest encryption** | NIST SP 800-111: AES-256 (XTS/CBC) | IndexedDB doesn't encrypt natively. Use Web Crypto API to encrypt sensitive fields before storage. |
| **Data in transit** | NIST SP 800-52: TLS 1.2+ (TLS 1.3 recommended) | Enforced by Supabase/HTTPS. Service worker must not cache auth tokens. |
| **Audit logs** | HIPAA 45 CFR 164.312(b): 6+ years retention, tamper-proof | Store audit events in Supabase (not IndexedDB). Include: user, action, timestamp, resource, outcome. |
| **Breach safe harbor** | Encrypted ePHI + secure keys = no notification required | Encrypt patient PII in IndexedDB. Use device-specific keys. |
| **Offline auth** | Session tokens expire (30 min) — breaks offline | **Device tokens**: long-lived token stored in IndexedDB, refreshed when online. Trade-off: reduced security offline. |

### Sources
- [Censinet - HIPAA Encryption](https://censinet.com/perspectives/hipaa-encryption-vs-other-standards-clinical-apps) — AES-256 at rest, TLS 1.3 in transit
- [HIPAA Audit Logs](https://www.hipaavault.com/resources/hipaa-audit-logs) — Immutable logs, 6+ years retention
- [Alamb-hex - Building True Offline-First PWAs](https://alamb-hex.github.io/blog/2026/01/21/building-true-offline-first-pwas/) — Device tokens for offline auth, security trade-offs documented

### Practical Recommendation for MediQ

1. **Encrypt sensitive fields in IndexedDB** (patient name, DOB, phone) using Web Crypto API with a device-derived key
2. **Never cache auth tokens** in service worker — configure `runtimeCaching` to exclude `/auth/*` endpoints
3. **Audit trail in Supabase only** — every sync attempt (success/failure) logged server-side with `user_id`, `booking_id`, `idempotency_key`, `timestamp`, `outcome`
4. **Device token pattern** for offline auth: generate on first login, store encrypted in IndexedDB, include in all API requests
5. **Minimize offline PII** — only store booking form data, not full patient records

---

## 7. Real-World Examples

### Search Queries
- `supabase pwa example`
- `offline first react supabase`
- `github offline first supabase`

### Key Findings

| Project | Stack | Description | Link |
|---------|-------|-------------|------|
| **BaseOps** | Next.js + Supabase + Dexie.js + @ducanh2912/next-pwa | Multi-tenant logistics PWA. Drivers offline in dead zones. Mutation queue in Dexie, auto-sync. | [GitHub](https://github.com/JohnApollos/baseops) |
| **Supabase + WatermelonDB** | React Native/Expo + WatermelonDB + Supabase | Official Supabase blog tutorial. Local SQLite, sync via RPC push/pull. | [Blog](https://supabase.com/blog/react-native-offline-first-watermelon-db) |
| **Supabase + PowerSync** | PowerSync + Supabase | Managed sync service. Local SQLite, bidirectional sync, conflict resolution. | [PowerSync Blog](https://www.powersync.com/blog/offline-first-apps-made-simple-supabase-powersync) |
| **WellAlly Health Tracker** | React + Dexie.js + Workbox | Health tracking PWA. Background Sync for workout logging. 35-40% higher engagement. | [WellAlly](https://www.wellally.tech/blog/build-offline-pwa-react-dexie-workbox) |
| **Path (Trip Planning)** | React + Vite + idb + Supabase | Offline-first trip planner. IndexedDB via idb, PWA manifest, background sync. | [Case Study](https://charles-chen.com/projects/path) |
| **Offline-First Starter** | React Native/Expo + Supabase | Production-ready starter with auth, sync, storage, UI. | [GitHub](https://github.com/zazakia/offline-first-starter) |

### Practical Recommendation

**Reference BaseOps** (Next.js) and **WellAlly** (React/Vite) as closest architectural matches. Both use:
- Dexie.js for IndexedDB
- Custom mutation queue (not Workbox BackgroundSyncPlugin — more control)
- Supabase RPC for server-side operations
- `navigator.onLine` + interval-based flush fallback

---

## 8. Limitations and Tradeoffs

### Search Queries
- `offline first pwa limitations what cannot work offline`
- `pwa cannot work offline realtime auth`

### Key Findings

| Cannot Work Offline | Reason | Mitigation |
|---------------------|--------|------------|
| **Real-time queue position** | Requires live Supabase Realtime subscription | Show "position unknown — will update when online" |
| **Doctor availability checks** | Slot availability changes in real-time | Cache last-known availability with timestamp; show "last checked: 2h ago" |
| **Patient authentication** | JWT expires, refresh needs network | Device tokens (long-lived) + re-auth when online |
| **Payment processing** | Requires live payment gateway | Queue payment intent, process on sync |
| **Multi-user conflict on same slot** | Two patients book same slot offline | Server-side row locking in RPC (FOR UPDATE SKIP LOCKED) |
| **Push notifications** | Requires push service + service worker | Queue locally, send when online |
| **File uploads (medical docs)** | Large files, need server processing | Store blob in IndexedDB, upload on sync with progress |

### Minimal Viable Offline Feature Set (MVP)

| Feature | Offline Support | Priority |
|---------|----------------|----------|
| View cached doctor list/schedule | ✅ Cache-first | P0 |
| Fill booking form | ✅ Local state | P0 |
| Submit booking (queued) | ✅ IndexedDB queue | P0 |
| Auto-sync on reconnect | ✅ Background Sync + fallback | P0 |
| View my bookings (cached) | ✅ IndexedDB read | P0 |
| Cancel booking | ❌ Requires server | P1 (online only) |
| Reschedule | ❌ Requires server | P1 (online only) |
| Real-time queue position | ❌ Requires Realtime | P2 |
| Doctor availability | ⚠️ Stale cache only | P1 |
| Patient login | ⚠️ Device tokens | P0 |

### Storage Constraints

| Constraint | Limit | Impact |
|------------|-------|--------|
| IndexedDB quota | 50-200MB per origin (browser-dependent) | Booking queue + cached schedules well within limit |
| iOS Safari auto-clear | 7 days of no use → wipes IndexedDB/Cache | Request persistent storage: `navigator.storage.persist()` |
| Service worker size | ~1MB script limit | Keep SW minimal — business logic in main thread |

---

## Recommended Implementation Plan

### Phase 1: Foundation (Week 1-2)

| Step | Task | Effort | Deliverable |
|------|------|--------|-------------|
| 1.1 | Add `vite-plugin-pwa` with `injectManifest` mode | 4h | `vite.config.ts` with PWA config |
| 1.2 | Create service worker (`public/sw.ts`) with: app shell precache, API NetworkFirst, BackgroundSyncPlugin for `/api/book-appointment` POST | 8h | Working SW, offline app shell |
| 1.3 | Add PWA manifest with medical-appropriate config (maskable icons, theme color, categories) | 2h | Installable PWA |
| 1.4 | Install Dexie.js + `dexie-react-hooks` | 1h | `package.json` |
| 1.5 | Create `MediQDB` with `queuedBookings` table + TypeScript types | 4h | `src/lib/db.ts` |

### Phase 2: Offline Booking Queue (Week 2-3)

| Step | Task | Effort | Deliverable |
|------|------|--------|-------------|
| 2.1 | Build `useBookingQueue` hook: `enqueueBooking()`, `getPendingCount()`, `useLiveQuery` for UI | 8h | Reactive queue UI |
| 2.2 | Implement `flushQueue()` with exponential backoff, idempotency keys, error handling | 12h | Reliable sync engine |
| 2.3 | Add Background Sync registration + `online`/`load` fallback listeners | 4h | Cross-browser sync |
| 2.4 | Service worker `sync` event handler calling `flushQueue()` | 4h | Background sync working |
| 2.5 | UI indicators: "Saved offline", "Syncing...", "Synced", "Failed" with retry button | 6h | User-facing status |

### Phase 3: Server-Side Hardening (Week 3)

| Step | Task | Effort | Deliverable |
|------|------|--------|-------------|
| 3.1 | Modify `book_appointment` RPC to accept `idempotency_key` parameter | 4h | Idempotent server endpoint |
| 3.2 | Add row-level locking (`FOR UPDATE SKIP LOCKED`) for slot allocation | 4h | Race-condition-free booking |
| 3.3 | Add audit logging table + trigger for all booking attempts | 4h | HIPAA-compliant audit trail |
| 3.4 | Implement device token auth pattern for offline-capable auth | 8h | Offline auth support |

### Phase 4: Security & Compliance (Week 4)

| Step | Task | Effort | Deliverable |
|------|------|--------|-------------|
| 4.1 | Encrypt sensitive fields in IndexedDB using Web Crypto API (AES-GCM) | 8h | Data-at-rest encryption |
| 4.2 | Configure service worker to NEVER cache `/auth/*` or responses with `Authorization` header | 2h | Token leakage prevention |
| 4.3 | Request persistent storage permission on first visit | 2h | iOS 7-day wipe protection |
| 4.4 | Add sync status to audit log (server-side): success/failure, idempotency key, timestamp | 4h | Complete audit trail |

### Phase 5: Testing & Polish (Week 4-5)

| Step | Task | Effort | Deliverable |
|------|------|--------|-------------|
| 5.1 | Offline testing checklist: disable network, submit 5 bookings, reload, go online, verify all sync | 4h | Verified offline flow |
| 5.2 | Duplicate submission test: same idempotency key submitted twice | 2h | Deduplication verified |
| 5.3 | Conflict test: two bookings for same slot offline | 2h | Server-side conflict handling |
| 5.4 | iOS Safari testing (PWA install, offline, 7-day wipe simulation) | 8h | Cross-platform verified |
| 5.5 | Lighthouse PWA audit (score >90) | 2h | Production-ready PWA |
| 5.6 | Documentation: offline architecture diagram, runbook for sync failures | 4h | Handoff docs |

---

## Total Estimated Effort: ~120 hours (3-4 weeks for 1 engineer)

### Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Background Sync unreliable in Firefox/Safari | High | Medium | Fallback is mandatory — test both paths equally |
| IndexedDB quota exceeded | Low | High | Monitor `navigator.storage.estimate()`, implement LRU cleanup |
| iOS 7-day auto-clear loses queue | Medium | High | Request persistent storage, warn users |
| Supabase RPC changes break sync | Low | High | Version RPC calls, backward-compatible queue payloads |
| Device token compromise | Low | High | Short expiry (30 days), server-side revocation, rate limiting |

---

## Appendix: Key Files to Create/Modify

```
MediQ/
├── public/
│   ├── sw.ts                    # Service worker (injectManifest entry)
│   ├── manifest.webmanifest     # PWA manifest (auto-generated)
│   └── icons/                   # PWA icons (192, 512, maskable)
├── src/
│   ├── lib/
│   │   ├── db.ts                # Dexie database + queue schema
│   │   ├── sync.ts              # flushQueue(), requestSync(), fallback listeners
│   │   ├── crypto.ts            # Web Crypto helpers for IndexedDB encryption
│   │   └── supabase.ts          # Supabase client + RPC wrappers
│   ├── hooks/
│   │   ├── useBookingQueue.ts   # Reactive queue state + actions
│   │   └── useOnlineStatus.ts   # navigator.onLine + online/offline events
│   ├── components/
│   │   ├── BookingForm.tsx      # Modified: enqueue instead of direct submit
│   │   ├── SyncStatusIndicator.tsx # Shows pending/synced/failed
│   │   └── OfflineBanner.tsx    # "You're offline — changes will sync"
│   └── pages/
│       └── BookAppointment.tsx  # Updated to use useBookingQueue
├── supabase/
│   └── migrations/
│       └── 20260821_offline_booking.sql  # RPC changes, audit table, idempotency
├── vite.config.ts               # VitePWA config with injectManifest
└── docs/
    └── OFFLINE_ARCHITECTURE.md  # Architecture decision record
```

---

## References

1. [ElectricSQL - Supabase Partner](https://supabase.com/partners/integrations/electricsql)
2. [Supascale - Offline-First with Self-Hosted Supabase](https://www.supascale.app/blog/building-offlinefirst-apps-with-selfhosted-supabase)
3. [John Apollos Olal - Offline-First PWA with Supabase and Dexie.js](https://johnapollosolal.medium.com/how-i-built-an-offline-first-pwa-with-supabase-and-dexie-js-and-why-it-was-harder-than-i-expected-8e14575fc412)
4. [vite-plugin-pwa GitHub](https://github.com/vite-pwa/vite-plugin-pwa)
5. [vite-plugin-pwa Issue #739 - Background Sync](https://github.com/vite-pwa/vite-plugin-pwa/issues/739)
6. [PkgPulse - Dexie vs idb vs localForage 2026](https://www.pkgpulse.com/guides/dexie-vs-localforage-vs-idb-indexeddb-browser-storage-2026)
7. [WellAlly - Offline-First PWA with React, Dexie.js & Workbox](https://www.wellally.tech/blog/build-offline-pwa-react-dexie-workbox)
8. [caniuse.com - Background Sync](https://caniuse.com/background-sync)
9. [InstantPWA - Background Sync in Production](https://instantpwa.com/blog/background-sync-api-guide)
10. [OpenReplay - Offline Form Submission with Background Sync](https://blog.openreplay.com/offline-form-submission-background-sync)
11. [ArchMan - Offline Sync & Conflict Resolution](https://archman.dev/docs/frontend-and-mobile-architecture/mobile-architecture/offline-sync-and-conflict-resolution)
12. [Censinet - HIPAA Encryption Standards](https://censinet.com/perspectives/hipaa-encryption-vs-other-standards-clinical-apps)
13. [Alamb-hex - Building True Offline-First PWAs](https://alamb-hex.github.io/blog/2026/01/21/building-true-offline-first-pwas/)
14. [BaseOps - Offline-First Logistics PWA](https://github.com/JohnApollos/baseops)
15. [Supabase Blog - React Native Offline-First with WatermelonDB](https://supabase.com/blog/react-native-offline-first-watermelon-db)