import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type OtpPurpose = 'signin' | 'signup' | 'reset'

export interface SendOtpResult {
  message: string
  expiresIn: number
  cooldown: number
}

export interface VerifyOtpResult {
  valid: boolean
  message: string
}

async function edgeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const context = (await error.context.json()) as { error?: string }
      return context?.error ?? 'Request failed. Please try again.'
    } catch {
      return 'Request failed. Please try again.'
    }
  }
  if (error instanceof Error) return error.message
  return 'Request failed. Please try again.'
}

/** Ask the send-otp Edge Function to email a 6-digit code (via Brevo). */
export async function sendOtp(input: {
  email: string
  purpose: OtpPurpose
}): Promise<SendOtpResult> {
  const { data, error } = await supabase.functions.invoke('send-otp', {
    body: input,
  })
  if (error) throw new Error(await edgeError(error))
  if (data?.error) throw new Error(String(data.error))
  return data as SendOtpResult
}

/** Verify a code against the verify-otp Edge Function. */
export async function verifyOtp(input: {
  email: string
  purpose: OtpPurpose
  code: string
}): Promise<VerifyOtpResult> {
  const { data, error } = await supabase.functions.invoke('verify-otp', {
    body: input,
  })
  if (error) throw new Error(await edgeError(error))
  if (data?.error) throw new Error(String(data.error))
  return data as VerifyOtpResult
}

/**
 * Set a new password after a verified 'reset' OTP. Authorized server-side by
 * the recently-consumed code (see the reset-password Edge Function).
 */
export async function resetPassword(input: {
  email: string
  newPassword: string
}): Promise<{ message: string }> {
  const { data, error } = await supabase.functions.invoke('reset-password', {
    body: input,
  })
  if (error) throw new Error(await edgeError(error))
  if (data?.error) throw new Error(String(data.error))
  return data as { message: string }
}