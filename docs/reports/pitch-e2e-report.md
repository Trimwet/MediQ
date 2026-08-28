# MediQ E2E Test Report — Pitch Demo

**Date:** 2026-08-21  
**URL:** http://localhost:3000  
**Admin:** jonahmafuyai@gmail.com / permitted  
**Test Model:** Qubik (Playwright browser tools)

---

## Summary

| # | Flow | Status | Notes |
|---|------|--------|-------|
| 1 | Landing | ✅ PASS | Hero, nav, stats, tabs, pricing (Free + 3 paid), CTAs → /create-clinic?plan= |
| 2 | Auth | ✅ PASS | Sign-in → /admin/dashboard, sign-out dialog, sign-in again, redirect |
| 3 | Create Clinic | ⚠️ PARTIAL | Authenticated: clinic-only form ✅, slug auto-gen ✅, availability check stuck |
| 4 | Booking | ✅ PASS | Doctor picker populated, date/time pickers, submit → success checklist, QR ticket, ref, progress bar |
| 5 | Check-in | ✅ PASS | Appointment details, Check In → queue position #1 created |
| 6 | Admin Dashboard | ✅ PASS | Analytics cards, charts, date range, team switcher, sidebar nav |
| 7 | Appointments | ✅ PASS | List with test booking (arrived), approve/reject action menu |
| 8 | Queue | ✅ PASS | Call next → Start visit → Complete → Served: 1 |
| 9 | CRUD (Doctors/Staff/Rooms/Patients) | ✅ PASS | Created "Pitch Test Doctor" (Cardiology), deleted it; Room "Pitch-99" created; Staff list 2 entries; Patients list with "Add patient" |
| 10 | Settings | ✅ PASS | Profile (name, phone, role, clinic), Display (lang/timezone), Account (password + 2FA + delete), Facility (rooms config) |
| 11 | Notifications | ✅ PASS | Bell dropdown: "No notifications yet." + View all link; /admin/notifications page loads |
| 12 | QR Ticket | ✅ PASS | Booking confirmation QR renders, patient/doctor/time/ref details, Print ticket button |

**Overall: 11/12 PASS, 1/12 PARTIAL**

---

## Console Errors (entire session)

Only **1 error** across all flows:

```
[ERROR] Failed to load resource: the server responded with a status of 400 ()
  @ https://snvdwamqjreuhtyrrrlg.supabase.co/auth/v1/token?grant_type=refresh_token
```

- This is a **Supabase token refresh 400** — fires on initial page load when session is stale/expired.
- **No AppSidebar loop errors.**
- **No realtime DNS errors.**
- **No JS runtime errors.** Zero console errors after authentication.

---

## Flow Details

### 1. Landing (`/`)
- **Hero:** "End Wait-Time Uncertainty in Healthcare" with subtext + CTAs
- **CTAs:** "Book an appointment" → `/book`, "Create an account" → `/sign-up`
- **Stats:** Appointments booked, Avg booking time, Active doctors, Queue transparency
- **Tabs:** For patients, For front desk, For hospitals, For administrators
- **How it works:** 3-step flow (Book → Track → Receive care)
- **Features:** Live queue board, Front-desk check-in, Booking with approval, Role-based access
- **Pricing:** Monthly/Yearly toggle (Save 20%)
  - Free: ₦0 — 2 staff, 1 location, 50 appointments/mo → `/create-clinic?plan=free`
  - Starter: ₦12,000/yr — 5 staff, 1 clinic → `/create-clinic?plan=starter`
  - Professional: ₦40,000/yr — Unlimited staff, 5 locations → `/create-clinic?plan=professional`
  - Enterprise: ₦120,000/yr — Unlimited everything → `/create-clinic?plan=enterprise`
- **CTA section:** "Ready to see MediQ in action?" with Book + Sign in
- **Footer:** Links, contact info

**Screenshot:** `pitch-e2e-01-landing.png`

### 2. Auth (`/sign-in`)
- Sign-in form with pre-filled credentials
- Email/Password fields, Forgot password, Show password toggle
- Sign-in button → redirects to `/admin/dashboard`
- User menu → Sign out → confirmation dialog → redirect to `/sign-in`
- Sign in again → `/admin/dashboard`
- No console errors

### 3. Create Clinic (`/create-clinic`)
- **Authenticated:** Shows clinic-only form (no account fields) ✅
  - Clinic name field → auto-generates URL slug (e.g., "Pitch Test Clinic" → `pitch-test-clinic`)
  - Availability check triggers ("Checking availability...") but **never resolves** ⚠️
  - Plan selector (Free ₦0/mo)
  - "Create clinic & continue" button stays disabled due to stuck availability check
- **Unauthenticated:** Not tested via incognito (browser tool limitation)

**Screenshot:** `pitch-e2e-03-create-clinic.png`

### 4. Booking (`/book`)
- **Form:** Full name, Email, Phone, Doctor (optional), Date, Time, Reason (optional)
- **Doctor picker:** Populated — "No preference" + "Orthopedics 1" ✅
- **Date picker:** Calendar dialog with past dates disabled, month/year selectors ✅
- **Time picker:** 9AM-4PM slots, 3PM marked "Fully booked" ✅
- **Helper text:** "We'll confirm within hours — if your slot isn't available we'll propose the closest alternative." ✅
- **Submit:** "Booking request sent" → success checklist (1→2 of 3)
- **QR ticket expandable:** Shows patient, doctor, time, full reference UUID
- **Print ticket button** ✅
- **Appointment ref:** `c08a004c-189d-4082-92d6-b2b618c08615`

**Screenshots:** `pitch-e2e-04-booking.png`, `pitch-e2e-12-qr-ticket.png`

### 5. Check-in (`/check-in?id=<uuid>`)
- Shows: Patient name, Scheduled time, Status (pending)
- Check In button → "Checked In!" with Queue position: #1
- No errors

### 6. Admin Dashboard (`/admin/dashboard`)
- **Analytics cards:** Today Booked (0), Completed (0), Pending (1), Avg Wait (--)
- **Charts:** 7-Day Trend, By Status, Doctor Utilization (all empty — no historical data)
- **Live stats:** Appointments, In queue, Served, Active doctors (1/1)
- **Timeline chart:** 9AM-5PM with appointment blocks
- **Recent Check-ins section**
- **Date range filter:** Today/7 days/30 days/Custom
- **Team Switcher:** "Default Clinic — professional plan" ✅
- **Sidebar:** Full nav (Dashboard, Appointments, Queue, Patients, Doctors, Staff, Rooms, Notifications, Settings)

**Screenshot:** `pitch-e2e-06-dashboard.png`

### 7. Appointments (`/admin/appointments`)
- Table with columns: Patient, Doctor, Date•Time, Reason, Status, Actions
- **Test booking found:** "Pitch Test Patient" — Aug 22, 10:00 AM — status: **arrived** ✅
- **Other entries:** 8+ rows with mixed statuses (pending, rejected)
- **Action menu:** "Review request" → Approve / Reject ✅
- **Pagination:** Page 1 of 2, rows per page selector
- **Search:** "Search patients, doctors..." + Status filter + View toggle

### 8. Queue (`/admin/queue`)
- **Stats:** Waiting (0→0), Now serving (0→1→0), Served today (0→1), Avg wait
- **Call next** button → moves patient from Waiting to Now serving (Called status)
- **Status progress:** Called → In room → Done
- **Actions:** Start visit → Complete / Mark left
- **Full lifecycle tested:** Waiting → Called → In room → Complete → Served

**Screenshot:** `pitch-e2e-08-queue.png`

### 9. CRUD Pages
- **Doctors:** Table with 1 doctor (Orthopedics). Created "Pitch Test Doctor" (Cardiology) → deleted ✅
- **Staff:** Table with 2 staff entries (front desk + doctor). "Invite staff" button, Role/Status filters ✅
- **Rooms:** Empty state ("No rooms yet"). Added "Pitch-99" (Consultation) → appears with "Mark cleaning" ✅
- **Patients:** Table with entries. "Add patient" button ✅

### 10. Settings
- **Profile:** Full name, Phone, Role (Admin), Clinic (Default Clinic), email (disabled), member since
- **Display:** Language (English), Timezone (Africa/Lagos), Date format, 24h toggle, Items per page
- **Account:** Change password (current/new/confirm), Email preferences (marketing/security), 2FA toggle, Delete account
- **Facility:** Track rooms toggle, Room label presets (Room/Office/Station/Booth/Desk/Bay/Consultation room)
- **Appearance** and **Notifications** sub-pages exist

### 11. Notifications
- **Bell dropdown:** "No notifications yet." + "View all notifications" menuitem
- **Page:** "No notifications yet." with tabs

### 12. QR Ticket
- Expandable in booking confirmation
- Shows: Patient, Doctor, When, Reference (full UUID)
- "Scan to check in" / "Present this QR code at the clinic reception"
- **Print ticket** button

---

## Screenshots Captured

| File | Content |
|------|---------|
| `pitch-e2e-01-landing.png` | Full landing page |
| `pitch-e2e-03-create-clinic.png` | Create clinic form (authenticated) |
| `pitch-e2e-04-booking.png` | Booking confirmation success |
| `pitch-e2e-06-dashboard.png` | Admin dashboard with analytics |
| `pitch-e2e-08-queue.png` | Queue with patient waiting |
| `pitch-e2e-12-qr-ticket.png` | Expanded QR ticket |

---

## Issues Found

1. **Create Clinic slug availability check** — Stuck at "Checking availability..." indefinitely. Button remains disabled. May be a backend API issue or timeout. (Severity: Medium — blocks clinic creation flow)

2. **Supabase token refresh 400** — Single error on initial load when no valid session. Expected behavior for unauthenticated state but indicates no graceful handling of stale tokens. (Severity: Low)

## What Works End-to-End

The **complete patient journey** works flawlessly:
> Landing → Book appointment → Receive QR ticket → Check in at clinic → Enter queue → Called by staff → In room → Complete visit

The **admin journey** works end-to-end:
> Sign in → Dashboard → Approve appointment → Manage queue → CRUD operations → Settings

**No AppSidebar loop, no realtime DNS errors, no JS runtime errors.**
