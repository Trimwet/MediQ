import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OTP_EXPIRY_SECONDS = 10 * 60
const RESEND_COOLDOWN_SECONDS = 60

/** 6-digit code from the Web Crypto CSPRNG (uniform, no Math.random). */
function generateCode(): string {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return String(buffer[0] % 1000000).padStart(6, '0')
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL')
    const senderName = Deno.env.get('BREVO_SENDER_NAME') ?? 'MediQ'

    if (!brevoApiKey || !senderEmail) {
      return errorResponse(
        'Missing BREVO_API_KEY or BREVO_SENDER_EMAIL environment variables.',
        500,
      )
    }

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

    if (!isValidEmail(email)) {
      return errorResponse('A valid email is required.')
    }
    if (purpose !== 'signin' && purpose !== 'signup' && purpose !== 'reset') {
      return errorResponse("Purpose must be 'signin', 'signup', or 'reset'.")
    }

    // Rate limit: allow one code per email + purpose per cooldown window.
    const { data: recent } = await supabaseAdmin
      .from('email_otps')
      .select('created_at')
      .eq('email', email)
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)

    if (recent && recent.length > 0) {
      const lastSent = new Date(String(recent[0].created_at)).getTime()
      const waitSeconds = Math.ceil(
        (RESEND_COOLDOWN_SECONDS - (Date.now() - lastSent) / 1000),
      )
      if (waitSeconds > 0) {
        return errorResponse(
          `Please wait ${waitSeconds}s before requesting another code.`,
          429,
        )
      }
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000)

    const { error: insertError } = await supabaseAdmin
      .from('email_otps')
      .insert({
        email,
        purpose,
        code_hash: await sha256(code),
        expires_at: expiresAt.toISOString(),
      })

    if (insertError) {
      console.error('OTP insert error:', insertError)
      return errorResponse('Could not create a verification code.', 500)
    }

    // Send the code via Brevo's Transactional Email API.
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject: 'Your MediQ verification code',
        htmlContent:
          `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">` +
          `<h2 style="margin:0 0 16px;color:#0f172a">MediQ verification code</h2>` +
          `<p style="font-size:15px;line-height:1.5;color:#334155">` +
          `Use the code below to verify your email address. It expires in 10 minutes.</p>` +
          `<p style="font-size:32px;font-weight:bold;letter-spacing:10px;color:#0f172a;margin:24px 0">${code}</p>` +
          `<p style="font-size:13px;line-height:1.5;color:#64748b">` +
          `If you didn't request this code, you can safely ignore this email.</p>` +
          `</div>`,
      }),
    })

    if (!brevoResponse.ok) {
      console.error(
        'Brevo send error:',
        brevoResponse.status,
        await brevoResponse.text(),
      )
      // The code row exists but the email never went out — drop it so the
      // cooldown doesn't block a retry.
      await supabaseAdmin
        .from('email_otps')
        .delete()
        .eq('email', email)
        .eq('purpose', purpose)
      return errorResponse('Could not send the email. Please try again.', 502)
    }

    return new Response(
      JSON.stringify({
        message: 'Verification code sent.',
        expiresIn: OTP_EXPIRY_SECONDS,
        cooldown: RESEND_COOLDOWN_SECONDS,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('send-otp error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unexpected error.', 400)
  }
})