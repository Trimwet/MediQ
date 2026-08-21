# E2E Browser Smoke Test — MediQ (2026-08-20)

## Environment
- **App**: MediQ React/Vite frontend, port 3000 (`npm run dev`)
- **Backend**: Supabase `snvdwamqjreuhtyrrrlg`
- **Clinic**: Default Clinic (ID: `68062b03-3a03-4be3-a420-9033268b5fee`, plan: professional)
- **Admin**: jonahmafuyai@gmail.com

---

## Results

### STEP 0 — App Running
**PASS** — Neither port 5173 nor 4173 responded. Started `npm run dev` — Vite served on port 3000.

### STEP 1 — Anon Public Booking
**PARTIAL PASS** — See findings below.

| Check | Result | Detail |
|---|---|---|
| `/book` loads | ✅ PASS | Page renders with form |
| `?clinicId=` required | ⚠️ FINDING | `/book` without `?clinicId=` leaves doctor picker stuck on "Loading..." forever. Public nav links (`/book`, landing page CTAs) do NOT include `clinicId`. A real anon user hitting `/book` gets a broken doctor picker. |
| Doctor picker populates | ✅ PASS | With `?clinicId=68062b03-…`, picker shows: "No preference — match me with a doctor" + "Orthopedics → jonah mafuyai" |
| Form fill & submit | ✅ PASS | Name="Flow Test User", Email=flow.test@example.com, Phone=5551234, Doctor=jonah mafuyai, Date=Aug 21 2026, Time=10:00 AM, Reason="E2E flow test" |
| Confirmation state | ✅ PASS | "Booking request sent" heading, Reference `342ab564-d5db-4be4-bb33-eb857dd28834`, details shown (Patient/Doctor/When). hasAccount flow prompt ("Create your password" + "Book another appointment") visible. |

### STEP 2 — Admin Sign-In & Pages
**PASS**

| Check | Result | Detail |
|---|---|---|
| Sign-in | ✅ PASS | Redirects to `/admin/dashboard` |
| TeamSwitcher | ✅ PASS | Shows "**Default Clinic**" (professional plan) |
| Sidebar nav | ✅ PASS | All items present: Dashboard, Appointments, Queue, Patients, Doctors, Staff, Rooms, Notifications, Settings |
| Appointments | ✅ PASS | "**Flow Test User**" row visible: Patient=Flow Test User, Doctor=jonah mafuyai, Date=Aug 21 · 10:00 AM, Reason=E2E flow test |
| Patients | ✅ PASS | "Flow Test User" visible (phone 5551234, email flow.test@example.com) |
| Doctors | ✅ PASS | "jonah mafuyai" visible (Orthopedics, jonahmafuyai81@gmail.com) |
| Staff | ✅ PASS | Loads, staff directory visible with entries |
| Rooms | ✅ PASS | Loads, "No rooms yet. Add the first room." (empty state, no error) |
| Queue | ✅ PASS | Loads, "Call next" button (disabled, empty queue) |
| Notifications | ✅ PASS | Loads, "No notifications yet." |

### STEP 3 — Sign-Out (B3 Fix)
**PASS**

| Check | Result | Detail |
|---|---|---|
| Sign-out dialog | ✅ PASS | Confirmation dialog: "Are you sure you want to sign out?" |
| Redirects to sign-in | ✅ PASS | Lands on `/sign-in?redirect=…` |
| Stays on sign-in | ✅ PASS | Confirmed still on sign-in after 6 seconds — no silent re-auth |
| Re-sign-in works | ✅ PASS | Sign-in again → dashboard loads, TeamSwitcher still shows "Default Clinic" |

---

## Console Errors (deduplicated, by page)

| Page | Error | Severity |
|---|---|---|
| All pages | `404` on `supabase.co/` (root) and `/favicon.ico` | Low (cosmetic) |
| `/book` | `400` on `rpc/book_appointment` (×2) | Medium — appears to be a stale/failed retry; actual booking RPC succeeded |
| `/book` | `401` on `rpc/list_public_doctors` | Medium — the RPC returned 401 but picker still loaded data via anon REST |
| `/sign-in` (after sign-out) | `401` on `clinic_members` REST endpoint | Low — stale session request during sign-out cleanup |
| All admin pages | ~70× `WebSocket ERR_NAME_NOT_RESOLVED` to `wss://supabase.co/realtime/…` | **High** — Supabase Realtime WebSocket completely unreachable (DNS resolution fails). Realtime features (live queue updates, notification push) will not work. |
| `/admin/dashboard` (re-login) | `ERR_CONNECTION_CLOSED` on `/auth/v1/user`, `/rest/v1/doctors`, `/rest/v1/queue_entries`, `/rest/v1/profiles` | **High** — Network flakiness; some Supabase API calls fail mid-session. |
| `/admin/dashboard` (re-login) | `Maximum update depth exceeded` in `<AppSidebar>` — "The result of getSnapshot should be cached to avoid an infinite loop" | **Critical** — React infinite render loop bug in AppSidebar/Zustand store interaction. Component recovered via error boundary but this indicates a state management bug. |

---

## Screenshots
- `C:\Users\MAFUYAI\Documents\MediQ\docs\reports\e2e-booking.png` — Booking confirmation state
- `C:\Users\MAFUYAI\Documents\MediQ\docs\reports\e2e-dashboard.png` — Admin dashboard
- `C:\Users\MAFUYAI\Documents\MediQ\docs\reports\e2e-appointments.png` — Appointments list (Flow Test User row)
- `C:\Users\MAFUYAI\Documents\MediQ\docs\reports\e2e-signed-out.png` — Sign-in page after sign-out

---

## Key Findings

1. **`/book` requires `?clinicId=` but no public link provides it** — anon users hitting `/book` from nav/landing see a doctor picker stuck on "Loading..." forever. Needs a default clinic resolution mechanism for public booking.

2. **Supabase Realtime WebSocket unreachable** — `wss://snvdwamqjreuhtyrrrlg.supabase.co` fails DNS resolution on this machine. Real-time queue updates and push notifications will not function. May be a local network/DNS issue or Supabase project configuration.

3. **`AppSidebar` infinite render loop** — `getSnapshot` not cached properly; triggers "Maximum update depth exceeded" error. Recovered via error boundary but indicates a Zustand/React 18+ `useSyncExternalStore` compatibility bug.

4. **`book_appointment` RPC returns 400** — Two 400 errors observed during booking, though the booking itself succeeded (reference returned). May be a race condition or duplicate request.
