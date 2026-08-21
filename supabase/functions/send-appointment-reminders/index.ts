import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// ============================================================================
// send-appointment-reminders
// Edge Function that runs on a cron (every 5 min) to send 24h and 2h email
// reminders for upcoming appointments via Resend.
//
// Flow:
//   1. For each reminder type ('24h', '2h'), call get_due_reminders() RPC.
//   2. For each due appointment, send an email via Resend.
//   3. On success, insert into reminder_logs (idempotent — unique constraint).
//   4. Also create an in_app notification + recipients for clinic staff.
//   5. Return counts and any errors.
//
// Auth: expects service role key in Authorization header (cron auth).
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

function buildSubject(type: string, doctorName: string, timeStr: string): string {
  if (type === "24h") {
    return `Reminder: Your appointment tomorrow at ${timeStr} with Dr. ${doctorName}`
  }
  return "Reminder: Your appointment in 2 hours"
}

function buildHtml(type: string, patientName: string, doctorName: string, timeStr: string): string {
  const greeting = `Hello ${patientName},`
  if (type === "24h") {
    return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 16px;">Appointment Reminder</h2>
        <p>${greeting}</p>
        <p>This is a reminder that you have an appointment <strong>tomorrow</strong> at <strong>${timeStr}</strong> with <strong>Dr. ${doctorName}</strong>.</p>
        <p>Please arrive 10 minutes early. If you need to reschedule, contact the clinic as soon as possible.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #888;">This reminder was sent by MediQ.</p>
      </div>`
  }
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 16px;">Appointment Reminder</h2>
      <p>${greeting}</p>
      <p>This is a reminder that your appointment with <strong>Dr. ${doctorName}</strong> is in <strong>2 hours</strong> (at <strong>${timeStr}</strong>).</p>
      <p>Please arrive 10 minutes early. If you need to reschedule, contact the clinic as soon as possible.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size: 12px; color: #888;">This reminder was sent by MediQ.</p>
    </div>`
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // --- Env ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const resendApiKey = Deno.env.get("RESEND_API_KEY")
    const fromEmail = Deno.env.get("FROM_EMAIL") || "MediQ <noreply@medique.app>"

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error("Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY")
    }

    // --- Supabase admin client ---
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // --- Auth check: only service role or admin ---
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      )
    }
    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      )
    }

    // --- Process each reminder type ---
    const results = { sent24h: 0, sent2h: 0, errors: [] as string[] }

    for (const type of ["24h", "2h"] as const) {
      // 1. Fetch due appointments
      const { data: dueReminders, error: rpcError } = await supabase.rpc(
        "get_due_reminders",
        { p_type: type, p_window_minutes: 5 }
      )

      if (rpcError) {
        results.errors.push(`RPC error (${type}): ${rpcError.message}`)
        continue
      }

      if (!dueReminders || dueReminders.length === 0) {
        continue
      }

      // 2. Process each reminder
      for (const reminder of dueReminders) {
        try {
          const timeStr = new Date(reminder.scheduled_for).toLocaleString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })

          // 2a. Send email via Resend
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [reminder.patient_email],
              subject: buildSubject(type, reminder.doctor_name, timeStr),
              html: buildHtml(type, reminder.patient_name, reminder.doctor_name, timeStr),
            }),
          })

          if (!emailRes.ok) {
            const emailErr = await emailRes.text()
            throw new Error(`Resend API ${emailRes.status}: ${emailErr}`)
          }

          // 2b. Log to reminder_logs (idempotent — unique constraint on appointment_id + type)
          const { error: logError } = await supabase.from("reminder_logs").insert({
            appointment_id: reminder.appointment_id,
            type: type,
            channel: "email",
            status: "sent",
            clinic_id: reminder.clinic_id,
          })

          if (logError) {
            // Unique constraint violation = already sent — skip silently
            if (logError.code === "23505") {
              continue
            }
            throw new Error(`reminder_logs insert: ${logError.message}`)
          }

          // 2c. Create in_app notification for clinic staff
          const subject = buildSubject(type, reminder.doctor_name, timeStr)
          const message =
            type === "24h"
              ? `Upcoming appointment: ${reminder.patient_name} with Dr. ${reminder.doctor_name} tomorrow at ${timeStr}`
              : `Upcoming appointment: ${reminder.patient_name} with Dr. ${reminder.doctor_name} in 2 hours (at ${timeStr})`

          const { data: notif, error: notifError } = await supabase
            .from("notifications")
            .insert({
              type: "appointment",
              channel: "in_app",
              title: subject,
              message,
              clinic_id: reminder.clinic_id,
            })
            .select("id")
            .single()

          if (notifError) {
            // Don't fail the whole run for notification logging issues
            console.error(`notifications insert: ${notifError.message}`)
          } else if (notif) {
            // 2d. Find clinic staff to receive the notification
            const { data: members } = await supabase
              .from("clinic_members")
              .select("user_id")
              .eq("clinic_id", reminder.clinic_id)

            if (members && members.length > 0) {
              const recipients = members.map((m: { user_id: string }) => ({
                notification_id: notif.id,
                user_id: m.user_id,
              }))
              const { error: recipError } = await supabase
                .from("notification_recipients")
                .insert(recipients)

              if (recipError) {
                console.error(`notification_recipients insert: ${recipError.message}`)
              }
            }
          }

          // Tally
          if (type === "24h") results.sent24h++
          else results.sent2h++
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          results.errors.push(`${type} ${reminder.appointment_id}: ${errMsg}`)
          console.error(`Reminder failed (${type}):`, errMsg)

          // Log failure
          await supabase.from("reminder_logs").insert({
            appointment_id: reminder.appointment_id,
            type: type,
            channel: "email",
            status: "failed",
            clinic_id: reminder.clinic_id,
          })
        }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error("Fatal:", errMsg)
    return new Response(JSON.stringify({ error: errMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
