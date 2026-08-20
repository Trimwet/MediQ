import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables.')
    }

    // 1. Create a Supabase client with the Service Role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 2. Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      throw new Error('Forbidden: Only admins can invite staff.')
    }

    // 3. Parse the request body
    const { email, name, role, specialization } = await req.json()

    if (!email || !name || !role) {
      throw new Error('Missing required fields: email, name, role')
    }

    // 4. Generate the invite link (this creates the user in auth.users)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email.toLowerCase(),
    })

    if (inviteError) {
      throw inviteError
    }

    const newUser = inviteData.user
    const inviteLink = inviteData.properties?.action_link

    if (!newUser || !inviteLink) {
      throw new Error('Failed to generate invite link')
    }

    // 5. The handle_new_user trigger creates a profile with role 'patient'. 
    // We need to update it to the correct role.
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: role, full_name: name })
      .eq('id', newUser.id)

    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError)
    }

    // 6. Insert into the correct domain table (doctors or staff)
    if (role === 'doctor') {
      await supabaseAdmin.from('doctors').insert({
        user_id: newUser.id,
        name: name,
        email: email.toLowerCase(),
        specialization: specialization || 'General Practice',
        status: 'active'
      })
    } else {
      await supabaseAdmin.from('staff').insert({
        name: name,
        email: email.toLowerCase(),
        role: role,
        phone: 'Pending', // Or ask in the form
        status: 'active'
      })
    }

    // 7. Return the invite link to the frontend
    return new Response(
      JSON.stringify({ 
        message: 'Staff invited successfully',
        inviteLink: inviteLink
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
