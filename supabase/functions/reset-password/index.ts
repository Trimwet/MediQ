import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// How long after a successfully verified reset OTP a password change is allowed.
const RESET_WINDOW_MINUTES = 10

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse('Missing SUPABASE environment variables.', 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json()
    const email = String(body.email ?? '').toLowerCase().trim()
    const newPassword = String(body.newPassword ?? '')

    if (!email) {
      return errorResponse('A valid email is required.')
    }
    if (newPassword.length < 7) {
      return errorResponse('Password must be at least 7 characters long.')
    }

    // Authorization: the email must have a recently verified 'reset' OTP.
    // The code is consumed by verify-otp before this function is called.
    const since = new Date(Date.now() - RESET_WINDOW_MINUTES * 60 * 1000)
    const { data: otps, error: otpError } = await supabaseAdmin
      .from('email_otps')
      .select('id')
      .eq('email', email)
      .eq('purpose', 'reset')
      .not('consumed_at', 'is', null)
      .gte('consumed_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (otpError) {
      console.error('OTP lookup error:', otpError)
      return errorResponse('Could not verify the reset request.', 500)
    }
    if (!otps || otps.length === 0) {
      return errorResponse(
        'No verified reset code found. Start the password reset again.',
      )
    }

    // Find the auth user by email (admin API, page size capped at 1000).
    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (listError) {
      console.error('User lookup error:', listError)
      return errorResponse('Could not look up the account.', 500)
    }

    const user = data?.users.find((u) => u.email?.toLowerCase() === email)
    if (!user) {
      return errorResponse('No account found for this email.', 404)
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword },
    )
    if (updateError) {
      console.error('Password update error:', updateError)
      return errorResponse('Could not update the password. Please try again.', 500)
    }

    // Revoke existing sessions so the old password no longer works anywhere.
    await supabaseAdmin.auth.admin.signOut(user.id)

    return new Response(
      JSON.stringify({ message: 'Password updated successfully.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('reset-password error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unexpected error.', 400)
  }
})