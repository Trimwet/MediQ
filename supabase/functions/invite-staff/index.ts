import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

function getCorsHeaders(req: Request): Record<string, string> {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "https://getmediq.vercel.app,http://localhost:3000"
  const allowedOrigins = raw.split(",").map((s) => s.trim()).filter(Boolean)
  const origin = req.headers.get("Origin") ?? ""
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables.")
    }

    // 1. Create a Supabase client with the Service Role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 2. Verify the caller is an admin (global admin OR clinic admin)
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    // 3. Parse the request body (need clinic_id/slug early to resolve caller clinic)
    const body = await req.json().catch(() => ({}))
    const { email, name, role, specialization, clinic_id: bodyClinicId, clinic_slug } = body

    if (!email || !name || !role) {
      throw new Error("Missing required fields: email, name, role")
    }

    // 4. Resolve caller clinic_id
    // Priority: explicit clinic_id > clinic_slug > caller's membership
    let callerClinicId: string | null = bodyClinicId ?? null

    if (!callerClinicId && clinic_slug) {
      const { data: clinic, error: clinicError } = await supabaseAdmin
        .from("clinics")
        .select("id")
        .eq("slug", clinic_slug)
        .single()
      if (clinicError || !clinic) {
        throw new Error(`Clinic not found for slug: ${clinic_slug}`)
      }
      callerClinicId = clinic.id
    }

    if (!callerClinicId) {
      // Fallback: get caller's clinic membership (spec example uses .single())
      // Use limit(1).maybeSingle() to be robust when user has multiple memberships
      const { data: callerMembership, error: membershipError } = await supabaseAdmin
        .from("clinic_members")
        .select("clinic_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()

      if (membershipError) {
        console.error("Failed to resolve caller clinic:", membershipError)
        throw new Error("Failed to resolve caller clinic")
      }
      if (!callerMembership) {
        // Try single() as spec fallback for single-clinic invariant
        const { data: singleMembership } = await supabaseAdmin
          .from("clinic_members")
          .select("clinic_id")
          .eq("user_id", user.id)
          .single()
        if (singleMembership) {
          callerClinicId = singleMembership.clinic_id
        } else {
          throw new Error("Caller has no clinic membership — cannot invite")
        }
      } else {
        callerClinicId = callerMembership.clinic_id
      }
    }

    if (!callerClinicId) {
      throw new Error("Could not resolve clinic_id for invite")
    }

    // 5. Authorize: allow global admin (profiles.role='admin') OR clinic admin (clinic_members.role='admin' for that clinic)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isGlobalAdmin = profile?.role === "admin"

    if (!isGlobalAdmin) {
      // Check clinic_members for admin role on the target clinic — bypasses RLS auth.uid() issue by using service_role
      const { data: callerClinicMembership } = await supabaseAdmin
        .from("clinic_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("clinic_id", callerClinicId)
        .maybeSingle()

      // Also try RPC equivalent for defense-in-depth (will be null when using service_role without JWT, so table check is primary)
      // const { data: rpcIsAdmin } = await supabaseAdmin.rpc("user_is_clinic_admin", { c_clinic_id: callerClinicId })

      const isClinicAdmin = callerClinicMembership?.role === "admin"

      if (!isClinicAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: Only clinic admins can invite staff." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        })
      }
    }

    // 6. Generate the invite link (this creates the user in auth.users)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: email.toLowerCase(),
    })

    if (inviteError) {
      throw inviteError
    }

    const newUser = inviteData.user
    const inviteLink = inviteData.properties?.action_link

    if (!newUser || !inviteLink) {
      throw new Error("Failed to generate invite link")
    }

    // 7. The handle_new_user trigger creates a profile with role 'patient'.
    // We need to update it to the correct role.
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: role, full_name: name })
      .eq("id", newUser.id)

    if (profileUpdateError) {
      console.error("Profile update error:", profileUpdateError)
    }

    // 8. Insert into the correct domain table WITH clinic_id (Critical #1 fix)
    if (role === "doctor") {
      const { error: doctorError } = await supabaseAdmin.from("doctors").insert({
        user_id: newUser.id,
        name: name,
        email: email.toLowerCase(),
        specialization: specialization || "General Practice",
        status: "active",
        clinic_id: callerClinicId,
      })
      if (doctorError) {
        console.error("Doctors insert error:", doctorError)
        throw new Error(`Failed to create doctor record: ${doctorError.message}`)
      }
    } else {
      const { error: staffError } = await supabaseAdmin.from("staff").insert({
        name: name,
        email: email.toLowerCase(),
        role: role,
        phone: "Pending",
        status: "active",
        clinic_id: callerClinicId,
      })
      if (staffError) {
        console.error("Staff insert error:", staffError)
        throw new Error(`Failed to create staff record: ${staffError.message}`)
      }
    }

    // 9. Insert into clinic_members so the invited user has tenant membership (Critical #2 fix)
    const { error: membershipInsertError } = await supabaseAdmin.from("clinic_members").insert({
      clinic_id: callerClinicId,
      user_id: newUser.id,
      role: role,
    })

    if (membershipInsertError) {
      console.error("clinic_members insert error:", membershipInsertError)
      // 23505 = unique violation (already a member) — idempotent, don't fail
      if (membershipInsertError.code !== "23505") {
        throw new Error(`Failed to create clinic membership: ${membershipInsertError.message}`)
      }
    }

    // 10. Return the invite link to the frontend
    return new Response(
      JSON.stringify({
        message: "Staff invited successfully",
        inviteLink: inviteLink,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    let status = 400
    if (message.includes("No authorization") || message.includes("Unauthorized")) status = 401
    else if (message.includes("Forbidden")) status = 403
    else if (message.includes("Clinic not found") || message.includes("no clinic membership") || message.includes("Caller has no clinic")) status = 403

    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: status,
      },
    )
  }
})
