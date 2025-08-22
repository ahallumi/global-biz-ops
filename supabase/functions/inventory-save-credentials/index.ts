import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { integrationId, provider, environment, accessToken } = await req.json()

    if (!integrationId || !accessToken) {
      throw new Error('Missing required parameters')
    }

    // Normalize and validate the access token
    let normalizedToken = accessToken.trim()
    
    // Remove "Bearer " prefix if present
    if (normalizedToken.startsWith('Bearer ')) {
      normalizedToken = normalizedToken.substring(7)
    }
    
    // Validate token format - Square tokens are typically 64+ characters
    if (normalizedToken.length < 32) {
      throw new Error('Access token appears to be invalid (too short)')
    }
    
    console.log('Token validation passed, length:', normalizedToken.length)

    // Get the app master key for encryption
    const appCryptKey = Deno.env.get('APP_CRYPT_KEY')
    if (!appCryptKey) {
      throw new Error('APP_CRYPT_KEY not configured')
    }

    console.log('Saving credentials for integration:', integrationId)

    // Encrypt the normalized access token using pgcrypto
    const { error: encryptError } = await supabase.rpc('save_encrypted_credentials', {
      p_integration_id: integrationId,
      p_access_token: normalizedToken,
      p_crypt_key: appCryptKey
    })

    if (encryptError) {
      console.error('Encryption error:', encryptError)
      throw encryptError
    }

    // Update integration settings
    const { error: updateError } = await supabase
      .from('inventory_integrations')
      .update({
        provider,
        environment,
        updated_at: new Date().toISOString()
      })
      .eq('id', integrationId)

    if (updateError) {
      console.error('Update error:', updateError)
      throw updateError
    }

    console.log('Credentials saved successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error saving credentials:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})