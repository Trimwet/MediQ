import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_ATTEMPTS = 5

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

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
    const purpose = String(body.purpose ?? '')
    const code = String(body.code ?? '').trim()

    if (!email || (purpose !== 'signin' && purpose !== 'signup' && purpose !== 'reset')) {
      return errorResponse('A valid email and purpose are required.')
    }
    if (!/^\d{6}$/.test(code)) {
      return errorResponse('Enter the 6-digit code.')
    }

    // Latest unconsumed, unexpired code for this email + purpose.
    const { data: rows, error: lookupError } = await supabaseAdmin
      .from('email_otps')
      .select('*')
      .eq('email', email)
      .eq('purpose', purpose)
      .is('consumed_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (lookupError) {
      console.error('OTP lookup error:', lookupError)
      return errorResponse('Could not verify the code.', 500)
    }
    if (!rows || rows.length === 0) {
      return errorResponse(
        'No active verification code found. Request a new one.',
      )
    }

    const row = rows[0]

    if (row.attempts >= MAX_ATTEMPTS) {
      return errorResponse(
        'Too many incorrect attempts. Request a new code.',
      )
    }

    if ((await sha256(code)) !== row.code_hash) {
      await supabaseAdmin
        .from('email_otps')
        .update({ attempts: Number(row.attempts) + 1 })
        .eq('id', row.id)
      return errorResponse('Invalid verification code.')
    }

    const { error: consumeError } = await supabaseAdmin
      .from('email_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id)

    if (consumeError) {
      console.error('OTP consume error:', consumeError)
      return errorResponse('Could not verify the code.', 500)
    }

    return new Response(
      JSON.stringify({ valid: true, message: 'Verification successful.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('verify-otp error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unexpected error.', 400)
  }
})