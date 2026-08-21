/**
 * MediQ Pitch Demo Seed Script
 * 
 * Seeds the database with polished demo data for a pitch presentation.
 * Run: node seed-pitch.mjs
 * 
 * Uses Supabase JS client authenticated as admin (jonahmafuyai@gmail.com / permitted).
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://snvdwamqjreuhtyrrrlg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNudmR3YW1xanJldWh0eXJycmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzI3ODEsImV4cCI6MjEwMjcwODc4MX0.slSsb4BXyCS12h3VE4I_OOhQQXv0v7lvwFUSztzHLPU'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

function log(msg) { console.log(`  ✅ ${msg}`) }
function logWarn(msg) { console.log(`  ⚠️  ${msg}`) }
function logErr(msg) { console.error(`  ❌ ${msg}`) }

async function main() {
  console.log('🏥 MediQ Pitch Demo Seed Script')
  console.log('================================\n')

  // ─────────────────────────────────────────────────
  // 0. Authenticate as admin
  // ─────────────────────────────────────────────────
  console.log('0. Authenticating as admin...')
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'jonahmafuyai@gmail.com',
    password: 'permitted'
  })
  if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1) }
  const adminId = authData.user.id
  log(`Authenticated: ${authData.user.email} (id: ${adminId})`)

  // ─────────────────────────────────────────────────
  // 1. Rename Default Clinic
  // ─────────────────────────────────────────────────
  console.log('\n1. Renaming Default Clinic...')
  const { data: clinic, error: clinicErr } = await supabase
    .from('clinics')
    .update({ name: 'JUTH', slug: 'juth' })
    .eq('slug', 'default')
    .select('id, name, slug')
    .single()

  let clinicId
  if (clinicErr) {
    logWarn(`Rename failed (${clinicErr.message}). Trying direct SQL update...`)
    // Try alternative: just get the existing clinic
    const { data: fallback } = await supabase.from('clinics').select('id, name, slug').eq('slug', 'default').single()
    if (fallback) {
      clinicId = fallback.id
      logWarn(`Using existing clinic: "${fallback.name}" (slug: ${fallback.slug}, id: ${clinicId})`)
    }
  } else {
    clinicId = clinic.id
    log(`Renamed to "${clinic.name}" (slug: ${clinic.slug}, id: ${clinicId})`)
  }

  if (!clinicId) {
    console.error('Could not find any clinic. Aborting.'); process.exit(1)
  }

  // ─────────────────────────────────────────────────
  // 2. Create 2 rooms
  // ─────────────────────────────────────────────────
  console.log('\n2. Creating rooms...')
  // First check what rooms already exist
  const { data: existingRooms } = await supabase.from('rooms').select('id, number').eq('clinic_id', clinicId)
  const existingNumbers = new Set((existingRooms || []).map(r => r.number))
  console.log(`  Existing rooms: ${existingRooms?.length || 0} (${[...existingNumbers].join(', ') || 'none'})`)

  const roomsToInsert = []
  if (!existingNumbers.has('101')) roomsToInsert.push({ number: '101', type: 'consultation', status: 'available', clinic_id: clinicId })
  if (!existingNumbers.has('102')) roomsToInsert.push({ number: '102', type: 'procedure', status: 'available', clinic_id: clinicId })

  if (roomsToInsert.length > 0) {
    const { data: newRooms, error: roomsErr } = await supabase.from('rooms').insert(roomsToInsert).select('id, number, type')
    if (roomsErr) {
      logErr(`Room insert failed: ${roomsErr.message}`)
      console.log('  ℹ️  If RLS blocks, run via SQL Editor:')
      roomsToInsert.forEach(r => console.log(`    INSERT INTO rooms (number,type,status,clinic_id) VALUES ('${r.number}','${r.type}','${r.status}','${clinicId}');`))
    } else {
      newRooms.forEach(r => log(`Room ${r.number} (${r.type}) created — id: ${r.id}`))
    }
  } else {
    logWarn('Rooms 101 and 102 already exist — skipping')
  }

  // ─────────────────────────────────────────────────
  // 3. Assign doctor to 2 appointments (leave others unassigned)
  // ─────────────────────────────────────────────────
  console.log('\n3. Assigning doctor to appointments...')
  const { data: doctor } = await supabase.from('doctors').select('id, name').eq('clinic_id', clinicId).limit(1).single()

  if (!doctor) {
    logWarn('No doctor found in clinic — skipping assignment')
  } else {
    console.log(`  Using doctor: ${doctor.name} (id: ${doctor.id})`)

    // Get unassigned pending appointments
    const { data: unassigned } = await supabase
      .from('appointments')
      .select('id, patient_name')
      .eq('clinic_id', clinicId)
      .is('doctor_id', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    console.log(`  Unassigned pending appointments: ${unassigned?.length || 0}`)

    // Assign first 2, leave rest unassigned
    const toAssign = (unassigned || []).slice(0, 2)
    const toLeave = (unassigned || []).slice(2)

    for (const appt of toAssign) {
      const { error } = await supabase
        .from('appointments')
        .update({ doctor_id: doctor.id, doctor_name: doctor.name })
        .eq('id', appt.id)
      if (error) logErr(`Failed to assign ${appt.patient_name}: ${error.message}`)
      else log(`Assigned ${appt.patient_name} → ${doctor.name}`)
    }

    if (toLeave.length > 0) {
      logWarn(`Left ${toLeave.length} appointment(s) unassigned: ${toLeave.map(a => a.patient_name).join(', ')}`)
    } else if (toAssign.length === 0) {
      logWarn('No unassigned pending appointments to assign')
    }
  }

  // ─────────────────────────────────────────────────
  // 4. Create 2 fresh appointments via book_appointment RPC
  // ─────────────────────────────────────────────────
  console.log('\n4. Creating fresh appointments for pitch flow...')

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const d = tomorrow.toISOString().split('T')[0] // YYYY-MM-DD

  const pitchAppts = [
    {
      name: 'Aisha Bello',
      email: 'pitch-demo-1@mediq.test',
      phone: '+234 801 234 5678',
      scheduled: `${d}T10:00:00+01:00`, // 10am WAT
      reason: 'Routine checkup'
    },
    {
      name: 'Chidi Okoro',
      email: 'pitch-demo-2@mediq.test',
      phone: '+234 802 345 6789',
      scheduled: `${d}T14:00:00+01:00`, // 2pm WAT
      reason: 'Follow-up'
    }
  ]

  // Resolve doctor ID for assignment
  let pitchDoctorId = null
  if (doctor) pitchDoctorId = doctor.id

  for (const a of pitchAppts) {
    // Use RPC (public, anonymous-safe)
    const anonSupabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: rpcResult, error: rpcErr } = await anonSupabase.rpc('book_appointment', {
      p_name: a.name,
      p_email: a.email,
      p_phone: a.phone,
      p_scheduled_for: a.scheduled,
      p_doctor_id: pitchDoctorId,
      p_reason: a.reason,
      p_clinic_id: clinicId
    })

    if (rpcErr) {
      logErr(`RPC failed for ${a.name}: ${rpcErr.message}`)
      // Fallback: direct insert as admin
      const { data: direct, error: directErr } = await supabase
        .from('appointments')
        .insert({
          patient_name: a.name,
          patient_email: a.email,
          doctor_id: pitchDoctorId,
          doctor_name: doctor?.name || null,
          scheduled_for: a.scheduled,
          status: 'pending',
          reason: a.reason,
          clinic_id: clinicId
        })
        .select('id')
        .single()
      if (directErr) logErr(`Direct insert also failed: ${directErr.message}`)
      else log(`${a.name} — booked (direct insert, id: ${direct.id})`)
    } else {
      // RPC returns the appointment row
      const apptId = rpcResult?.id || rpcResult
      log(`${a.name} — booked via RPC at ${a.scheduled} (id: ${apptId})`)
    }
  }

  // ─────────────────────────────────────────────────
  // 5. Create queue entry (arrived patient)
  // ─────────────────────────────────────────────────
  console.log('\n5. Creating queue entry...')

  // Find one of our newly booked appointments (or any pending) to mark as arrived
  const { data: queueTarget } = await supabase
    .from('appointments')
    .select('id, patient_name, scheduled_for, doctor_name')
    .eq('clinic_id', clinicId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (queueTarget) {
    // Update appointment to 'arrived'
    const { error: arriveErr } = await supabase
      .from('appointments')
      .update({ status: 'arrived' })
      .eq('id', queueTarget.id)

    if (arriveErr) {
      logErr(`Failed to mark arrived: ${arriveErr.message}`)
    } else {
      log(`${queueTarget.patient_name} marked as 'arrived'`)

      // Insert queue entry
      const { data: qe, error: qeErr } = await supabase
        .from('queue_entries')
        .insert({
          appointment_id: queueTarget.id,
          patient_name: queueTarget.patient_name,
          appointment_time: queueTarget.scheduled_for,
          doctor_name: queueTarget.doctor_name || 'Unassigned',
          clinic_id: clinicId,
          status: 'waiting'
        })
        .select('id, patient_name, status')
        .single()

      if (qeErr) {
        logErr(`Queue entry insert failed: ${qeErr.message}`)
        console.log('  ℹ️  Run via SQL Editor:')
        console.log(`    INSERT INTO queue_entries (appointment_id,patient_name,appointment_time,doctor_name,clinic_id,status) VALUES ('${queueTarget.id}','${queueTarget.patient_name}','${queueTarget.scheduled_for}','${queueTarget.doctor_name || 'Unassigned'}','${clinicId}','waiting');`)
      } else {
        log(`Queue entry: ${qe.patient_name} — status: ${qe.status} (id: ${qe.id})`)
      }
    }
  } else {
    logWarn('No pending appointment found to create queue entry')
  }

  // ─────────────────────────────────────────────────
  // 6. Create / verify test accounts
  // ─────────────────────────────────────────────────
  console.log('\n6. Creating / verifying test accounts...')

  const accounts = [
    { email: 'frontdesk.demo@mediq.test', password: 'Demo123!', full_name: 'Ada Eze', role: 'front_desk', phone: '+234 803 456 7890' },
    { email: 'doctor.demo@mediq.test', password: 'Demo123!', full_name: 'Dr. Emeka Obi', role: 'doctor', phone: '+234 804 567 8901', specialization: 'General Practice' }
  ]

  for (const acct of accounts) {
    console.log(`\n  Account: ${acct.email} (${acct.role})`)

    // Try sign-in first
    const testClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: signIn, error: signInErr } = await testClient.auth.signInWithPassword({
      email: acct.email, password: acct.password
    })

    let userId

    if (!signInErr && signIn?.user) {
      userId = signIn.user.id
      log(`Account exists (id: ${userId})`)
    } else {
      // Sign up
      const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
        email: acct.email,
        password: acct.password,
        options: { data: { name: acct.full_name, phone: acct.phone } }
      })

      if (signUpErr) {
        logErr(`Sign-up failed: ${signUpErr.message}`)
        continue
      }

      userId = signUp.user?.id
      if (!userId) {
        logWarn('Sign-up returned no user (email confirmation may be required)')
        // Try to find user via admin insert attempt
        continue
      }
      log(`Account created (id: ${userId})`)
    }

    // Update profile role + name
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ role: acct.role, full_name: acct.full_name, phone: acct.phone })
      .eq('id', userId)

    if (profErr) logErr(`Profile update failed: ${profErr.message}`)
    else log(`Profile: role=${acct.role}, name="${acct.full_name}"`)

    // Ensure clinic membership
    const { error: memErr } = await supabase
      .from('clinic_members')
      .upsert({ clinic_id: clinicId, user_id: userId, role: acct.role }, { onConflict: 'clinic_id,user_id' })

    if (memErr) logErr(`Clinic membership failed: ${memErr.message}`)
    else log(`Clinic membership ensured`)

    // If doctor, ensure doctors table row
    if (acct.role === 'doctor') {
      const { data: existingDoc } = await supabase
        .from('doctors').select('id').eq('user_id', userId).limit(1)

      if (!existingDoc || existingDoc.length === 0) {
        const { error: docErr } = await supabase.from('doctors').insert({
          user_id: userId, name: acct.full_name, email: acct.email,
          specialization: acct.specialization, status: 'active', clinic_id: clinicId
        })
        if (docErr) logErr(`Doctor row insert failed: ${docErr.message}`)
        else log(`Doctor row created (specialization: ${acct.specialization})`)
      } else {
        log(`Doctor row already exists (id: ${existingDoc[0].id})`)
      }
    }
  }

  // Re-auth as admin for final checks
  await supabase.auth.signInWithPassword({ email: 'jonahmafuyai@gmail.com', password: 'permitted' })

  // ─────────────────────────────────────────────────
  // 7. Check doctor's duplicate patient record
  // ─────────────────────────────────────────────────
  console.log('\n7. Checking doctor\'s patient record...')
  const { data: docPatient } = await supabase
    .from('patients').select('id, name, email').eq('email', 'jonahmafuyai81@gmail.com').limit(1)

  if (docPatient && docPatient.length > 0) {
    console.log(`  Found patient record: "${docPatient[0].name}" (${docPatient[0].email})`)
    // Check if linked to any appointment
    const { count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('patient_email', 'jonahmafuyai81@gmail.com')
    console.log(`  Linked appointments: ${count || 0}`)
    if (!count || count === 0) {
      console.log('  → No appointments linked — this is the doctor\'s own test record')
      console.log('  → Keeping it (harmless, can delete later if desired)')
    }
  } else {
    console.log('  No duplicate patient record found for doctor')
  }

  // ─────────────────────────────────────────────────
  // FINAL COUNTS
  // ─────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55))
  console.log('  📊 FINAL DATABASE STATE')
  console.log('═'.repeat(55))

  const tables = [
    'clinics', 'clinic_members', 'profiles', 'doctors', 'staff',
    'patients', 'appointments', 'rooms', 'queue_entries', 'notifications'
  ]

  for (const t of tables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ${t.padEnd(22)} ${count ?? 'err'}`)
  }

  // ─────────────────────────────────────────────────
  // CREDENTIALS SUMMARY
  // ─────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55))
  console.log('  🔑 PITCH DEMO CREDENTIALS')
  console.log('═'.repeat(55))
  console.log(`
  ┌─────────────────────────────────────────────────────────┐
  │ 1. ADMIN (existing)                                     │
  │    📧 jonahmafuyai@gmail.com                            │
  │    🔐 permitted                                         │
  │    👤 Role: admin | 🏥 JUTH                              │
  │    🎯 Demo: Full dashboard, all analytics, settings     │
  ├─────────────────────────────────────────────────────────┤
  │ 2. FRONT DESK                                           │
  │    📧 frontdesk.demo@mediq.test                         │
  │    🔐 Demo123!                                          │
  │    👤 Role: front_desk | 🏥 JUTH                        │
  │    🎯 Demo: Check-in, queue mgmt, appointment triage    │
  ├─────────────────────────────────────────────────────────┤
  │ 3. DOCTOR                                               │
  │    📧 doctor.demo@mediq.test                            │
  │    🔐 Demo123!                                          │
  │    👤 Role: doctor | 🏥 JUTH                            │
  │    🎯 Demo: Patient list, schedule, appointment view    │
  └─────────────────────────────────────────────────────────┘
`)

  console.log('✅ Seed complete! Database ready for pitch demo.')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
