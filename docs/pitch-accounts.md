# MediQ Pitch Demo — Account Credentials

**Generated:** August 21, 2026  
**Clinic:** JUTH (slug: `juth`)

---

## Demo Accounts

| # | Role | Email | Password | What to Demo |
|---|------|-------|----------|--------------|
| 1 | **Admin** | `jonahmafuyai@gmail.com` | `permitted` | Full dashboard, analytics, settings, staff management |
| 2 | **Front Desk** | `frontdesk.demo@mediq.test` | `Demo123!` | Patient check-in, queue management, appointment triage |
| 3 | **Doctor** | `doctor.demo@mediq.test` | `Demo123!` | Patient list, schedule, appointment details |

---

## Demo Flow Suggestion

### Act 1 — Admin Dashboard (2 min)
1. Sign in as `jonahmafuyai@gmail.com`
2. Show the dashboard overview: today's appointments, queue status
3. Navigate to Analytics — show patient volume, appointment trends
4. Show Settings / Staff page

### Act 2 — Front Desk Check-in (2 min)
1. Sign out, sign in as `frontdesk.demo@mediq.test` (Ada Eze)
2. Show the Queue page — Chidi Okoro is already "waiting"
3. Show how to check in a patient, call them to a room
4. Show appointment list with mix of assigned/unassigned

### Act 3 — Doctor View (1 min)
1. Sign out, sign in as `doctor.demo@mediq.test` (Dr. Emeka Obi)
2. Show patient list, today's appointments
3. Show the cleaner, focused doctor UI

---

## Pre-seeded Data Summary

| Table | Count | Notes |
|-------|-------|-------|
| clinics | 1 | JUTH |
| clinic_members | 5 | admin, front_desk, doctor×2, admin(demo) |
| profiles | 6 | admin, front_desk, doctor×2, patient×2 |
| doctors | 2 | jonah mafuyai (Orthopedics), Dr. Emeka Obi (General Practice) |
| patients | 6 | David, mohammed×2, Isaac×2, jonah (test), + new Aisha/Chidi |
| appointments | 8 | 2 assigned, 4 unassigned, 1 arrived (Chidi), 1 fresh (Aisha) |
| rooms | 3 | 101 (consultation), 102 (procedure), Pitch-99 (existing) |
| queue_entries | 1 | Chidi Okoro — waiting |
| notifications | 0 | — |

### Appointments Breakdown
- **2 assigned** to jonah mafuyai (David, mohammed) — shows "assigned" state
- **4 unassigned** (mohammed, Isaac×3) — shows "pending unassigned" state  
- **1 fresh** (Aisha Bello, 10am tomorrow) — booked via RPC, shows new booking flow
- **1 arrived** (Chidi Okoro, 2pm tomorrow) — in queue, shows check-in flow

---

## ⚠️ Action Required: Confirm Test Accounts

The test accounts were created via `signUp` and require email confirmation. Before the pitch:

### Option A: Disable Email Confirmation (Recommended for Demo)
1. Go to **Supabase Dashboard → Project → Authentication → Settings**
2. Under **Email**, disable "Enable email confirmations"
3. Accounts will work immediately

### Option B: Manually Confirm via SQL Editor
Run this in the **Supabase Dashboard → SQL Editor**:
```sql
UPDATE auth.users 
SET email_confirmed_at = now(), 
    confirmed_at = now()
WHERE email IN ('frontdesk.demo@mediq.test', 'doctor.demo@mediq.test');
```

---

## Notes

- **Doctor's patient record:** "jonah mafuyai" (`jonahmafuyai81@gmail.com`) exists in patients table with 0 linked appointments — this is the doctor's own test record, harmless
- **Clinic rename:** Successfully renamed from "Default Clinic" → "JUTH" (slug: `juth`)
- **Room Pitch-99:** Pre-existing room from earlier testing, now alongside the 2 new rooms
- **Seed script:** `mediq-admin/seed-pitch.mjs` — can be re-run if needed (idempotent for most operations)
