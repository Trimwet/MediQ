# MediQ Data Inventory — Post-Cleanup (Pitch-Ready)
> Updated: 2026-08-21 | Supabase: snvdwamqjreuhtyrrrlg
> Cleanup script: `mediq-admin/cleanup-test-data.mjs` (run 2026-08-21)

---

## 1. Anon vs Authenticated Access

| Table | Anon Access | Auth Access |
|-------|-------------|-------------|
| clinics | ❌ 401 permission denied | ✅ |
| clinic_members | ❌ | ✅ |
| profiles | ❌ | ✅ |
| appointments | ❌ | ✅ |
| patients | ❌ | ✅ |
| doctors | ❌ | ✅ |
| staff | ❌ | ✅ |
| rooms | ❌ | ✅ |
| notifications | ❌ | ✅ |
| queue_entries | ❌ | ✅ |
| reminder_logs | ❌ table doesn't exist |

**RLS is enforced** — anon users cannot read any data tables. All queries below are via authenticated admin session.

---

## 2. Table Row Counts

| Table | Count | Notes |
|-------|-------|-------|
| clinics | **1** | Default Clinic |
| clinic_members | **3** | admin, front_desk, doctor |
| profiles | **4** | admin, front_desk, doctor, patient |
| appointments | **5** | David×1, mohammed×2, Isaac×2 — all pending |
| patients | **4** | David, mohammed, Isaac, jonah (doctor's record) |
| doctors | **1** | Orthopedics |
| staff | **2** | front_desk, doctor |
| rooms | **0** | |
| notifications | **0** | |
| queue_entries | **0** | |
| reminder_logs | **N/A** | table missing from schema |

---

## 3. Auth Users (Supabase Auth)

| Email | User ID | Created |
|-------|---------|---------|
| jonahmafuyai@gmail.com | 2aa42400-de63-4549-a413-704d4b6d49c7 | 2026-08-19 |

> Only **1 auth user** exists. The admin (jonahmafuyai@gmail.com) is the sole registered auth user.

---

## 4. Clinics

| Name | Slug | Plan | Created |
|------|------|------|---------|
| Default Clinic | `default` | professional | 2026-08-20 |

> **1 clinic total.** No test clinics with slugs matching `e2e-*`, `test-*`, or `demo-*` found.

---

## 5. Clinic Members (All 3 — post-cleanup)

| User ID | Role | Clinic |
|---------|------|--------|
| 2aa42400... (jonahmafuyai) | admin | Default Clinic |
| dbf27702... (front_desk) | front_desk | Default Clinic |
| 0d5cbdaa... (doctor) | doctor | Default Clinic |

> Only **1 member** — the admin owns the sole clinic.

---

## 6. Profiles (All 4 — post-cleanup)

| Full Name | Role | Phone | Created |
|-----------|------|-------|---------|
| jonahmafuyai | admin | 08012345678 | 2026-08-19 |
| jonah mafuyai | front_desk | (none) | 2026-08-20 04:18 |
| jonah mafuyai | doctor | (none) | 2026-08-20 04:25 |
| jonah mafuyai | patient | +2349063546728 | 2026-08-21 02:46 |

---

## 7. Appointments (All 5 — post-cleanup, all pending)

| Patient Name | Email | Doctor | Status | Scheduled | Created |
|-------------|-------|--------|--------|-----------|---------|
| **David** | davidagharandu@gmail.com | *(none)* | pending | 2026-08-29 | 08-20 11:19 |
| **mohammed zakari** | zakarimohammed995@gmail.com | *(none)* | pending | 2026-09-05 | 08-20 12:10 |
| **mohammed zakari** | zakarimohammed995@gmail.com | *(none)* | pending | 2026-09-05 | 08-20 12:15 |
| **Isaac Yakubu** | isaacyakubu544@gmail.com | *(none)* | pending | 2026-08-29 | 08-20 19:52 |
| **Isaac Yakubu** | isaacyakubu544@gmail.com | *(none)* | pending | 2026-08-22 | 08-20 21:12 |

---

## 8. Patients (All 4 — post-cleanup)

| Name | Email | Phone | Visits |
|------|-------|-------|--------|
| jonah mafuyai | jonahmafuyai81@gmail.com | +2349063546728 | 0 |
| David | davidagharandu@gmail.com | 08137592694 | 0 |
| mohammed zakari | zakarimohammed995@gmail.com | +234 7015702584 | 0 |
| Isaac Yakubu | isaacyakubu544@gmail.com | +2347010055727 | 0 |

---

## 9. Doctors (All 1)

| Name | Email | Specialization | Status |
|------|-------|----------------|--------|
| jonah mafuyai | jonahmafuyai81@gmail.com | Orthopedics | active |

---

## 10. Staff (All 2)

| Name | Email | Role | Status |
|------|-------|------|--------|
| jonah mafuyai | mafuyaijonah1@gmail.com | front_desk | active |
| jonah mafuyai | jonahmafuyai81@gmail.com | doctor | active |

---

## 11. Empty Tables

| Table | Status |
|-------|--------|
| rooms | 0 rows |
| notifications | 0 rows |
| queue_entries | 0 rows |
| reminder_logs | Table does not exist |

---

## 12. Test Data — DELETED (2026-08-21)

### Deleted Rows (12 total)

| Table | Filter | Rows | Reason |
|-------|--------|------|--------|
| appointments | patient_email = `flow.test@example.com` | 1 | E2E test appointment |
| appointments | patient_email = `mafuyaijonah1@gmail.com` | 1 | Dev test appointment |
| appointments | patient_email = `jonahmafuyai81@gmail.com` AND status = `rejected` | 3 | Rejected test bookings |
| appointments | patient_email = `e2e-pitch-1@test.local` | 1 | E2E test appointment |
| patients | email = `flow.test@example.com` | 1 | E2E test patient |
| patients | email = `mafuyaijonah1@gmail.com` | 1 | Dev test patient |
| patients | email = `e2e-pitch-1@test.local` | 1 | E2E test patient |
| profiles | role = `patient` AND full_name = '' AND phone IS NULL | 2 | Anonymous test profiles |
| queue_entries | appointment_id for `e2e-pitch-1@test.local` | 1 | E2E test queue entry |

> **No RLS errors** — all deletes succeeded via authenticated admin session.

### ✅ DEMO-WORTHY DATA (should KEEP for pitch)

| Type | Name | Email | Reason |
|------|------|-------|--------|
| **Auth User** | jonahmafuyai | jonahmafuyai@gmail.com | Admin — pitch presenter |
| **Profile (admin)** | jonahmafuyai | — | Real admin account |
| **Clinic** | Default Clinic | — | Pitch clinic (may rename) |
| **Clinic Member** | admin | — | Owner |
| **Patient** | David | davidagharandu@gmail.com | Real patient data |
| **Patient** | mohammed zakari | zakarimohammed995@gmail.com | Real patient data |
| **Patient** | Isaac Yakubu | isaacyakubu544@gmail.com | Real patient data |
| **Appointment** | David → pending | — | Real appointment |
| **Appointment** | mohammed zakari (×2) → pending | — | Real appointments |
| **Appointment** | Isaac Yakubu (×2) → pending | — | Real appointments |
| **Doctor** | jonah mafuyai | jonahmafuyai81@gmail.com | Orthopedics — demo doctor |
| **Staff (front_desk)** | jonah mafuyai | mafuyaijonah1@gmail.com | Demo front desk |
| **Staff (doctor)** | jonah mafuyai | jonahmafuyai81@gmail.com | Demo doctor staff entry |
| **Profile (doctor)** | jonah mafuyai | — | Doctor profile |
| **Profile (front_desk)** | jonah mafuyai | — | Front desk profile |

---

## 13. Post-Cleanup State

### Remaining Data (15 rows)

| Table | Count | Rows |
|-------|-------|------|
| clinics | 1 | Default Clinic |
| clinic_members | 3 | admin, front_desk, doctor |
| profiles | 4 | admin, front_desk, doctor, patient |
| appointments | 5 | David×1, mohammed×2, Isaac×2 |
| patients | 4 | David, mohammed, Isaac, jonah (doctor) |
| doctors | 1 | Orthopedics |
| staff | 2 | front_desk, doctor |

### KEEP — Demo Dataset (Pitch-Ready)

| Type | Name | Email | Reason |
|------|------|-------|--------|
| **Auth User** | jonahmafuyai | jonahmafuyai@gmail.com | Admin — pitch presenter |
| **Profile (admin)** | jonahmafuyai | — | Real admin account |
| **Clinic** | Default Clinic | — | Pitch clinic |
| **Clinic Members** | admin, front_desk, doctor | — | All 3 roles represented |
| **Patient** | David | davidagharandu@gmail.com | Real patient data |
| **Patient** | mohammed zakari | zakarimohammed995@gmail.com | Real patient data |
| **Patient** | Isaac Yakubu | isaacyakubu544@gmail.com | Real patient data |
| **Patient** | jonah mafuyai | jonahmafuyai81@gmail.com | Doctor's own record |
| **Appointment** | David → pending | — | Real appointment |
| **Appointment** | mohammed zakari (×2) → pending | — | Real appointments |
| **Appointment** | Isaac Yakubu (×2) → pending | — | Real appointments |
| **Doctor** | jonah mafuyai | jonahmafuyai81@gmail.com | Orthopedics — demo doctor |
| **Staff (front_desk)** | jonah mafuyai | mafuyaijonah1@gmail.com | Demo front desk |
| **Staff (doctor)** | jonah mafuyai | jonahmafuyai81@gmail.com | Demo doctor staff entry |
| **Profile (doctor)** | jonah mafuyai | — | Doctor profile |
| **Profile (front_desk)** | jonah mafuyai | — | Front desk profile |
| **Profile (patient)** | jonah mafuyai | — | Patient profile |

### RENAME (optional — pitch polish)

| Current | Suggested |
|---------|-----------|
| Default Clinic | e.g. "Lagos General Hospital" or "Demo Hospital" |
| slug: `default` | e.g. `lagos-general` or `demo-hospital` |
| plan: `professional` | Keep as-is |

### AUTH USERS

| User | Action |
|------|--------|
| jonahmafuyai@gmail.com | **KEEP** — only auth user, pitch presenter |

> No extra auth users to clean up. All test data was created via the public booking form (not auth signup).

---

## 14. Notes

- **No test clinics** found — no `e2e-*`, `test-*`, or `demo-*` slug patterns.
- **reminder_logs table is missing** from the database schema — may need to be created.
- **rooms** and **notifications** tables exist but are empty — ready for demo data.
- **queue_entries** table exists but is empty — ready for demo data.
- The `clinic_members` table has no `id` column (uses composite PK of `clinic_id` + `user_id`).
- All 5 remaining appointments have `doctor_id: null` — assign doctor for pitch demo.
- Patient "jonah mafuyai" (jonahmafuyai81@gmail.com) is the doctor's own record — may want to rename or remove for pitch clarity.
- **No RLS errors** during cleanup — all deletes succeeded via authenticated admin session.
