import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SQUARE_API_VERSION = '2025-07-17'

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

    const { integrationId } = await req.json()

    if (!integrationId) {
      throw new Error('Missing integration ID')
    }

    // Debug logging for APP_CRYPT_KEY availability
    console.log('🔐 [square-test-connection] ENV keys:', Object.keys(Deno.env.toObject()).filter(k => k.includes('CRYPT')))
    console.log('🔐 [square-test-connection] APP_CRYPT_KEY exists:', !!Deno.env.get('APP_CRYPT_KEY'))
    console.log('🔐 [square-test-connection] APP_CRYPT_KEY2 exists:', !!Deno.env.get('APP_CRYPT_KEY2'))

    // Get integration details and decrypt credentials - try APP_CRYPT_KEY first, then APP_CRYPT_KEY2
    const appCryptKey = Deno.env.get('APP_CRYPT_KEY') || Deno.env.get('APP_CRYPT_KEY2')
    if (!appCryptKey) {
      throw new Error('Neither APP_CRYPT_KEY nor APP_CRYPT_KEY2 is configured')
    }
    
    const keyUsed = Deno.env.get('APP_CRYPT_KEY') ? 'APP_CRYPT_KEY' : 'APP_CRYPT_KEY2'
    console.log('🔐 [square-test-connection] Using encryption key:', keyUsed)

    console.log('Testing connection for integration:', integrationId)

    // Get decrypted access token
    const { data: credentialsData, error: credentialsError } = await supabase.rpc('get_decrypted_credentials', {
      p_integration_id: integrationId,
      p_crypt_key: appCryptKey
    })

    if (credentialsError || !credentialsData) {
      console.error('Credentials error:', credentialsError)
      throw new Error('Failed to retrieve credentials')
    }

    const { access_token: rawToken, environment } = credentialsData

    // Trim token to remove any whitespace that could cause 401s
    const access_token = rawToken?.trim()
    if (!access_token) {
      throw new Error('Access token is empty or invalid after decryption')
    }

    // Validate token format (Square tokens are typically 64+ characters)
    if (access_token.length < 32) {
      console.warn('Access token appears unusually short:', access_token.length)
    }

    // Test connection by calling Square Locations API
    const baseUrl = environment === 'SANDBOX' 
      ? 'https://connect.squareupsandbox.com' 
      : 'https://connect.squareup.com'

    // Log debug info with masked token for troubleshooting
    const maskedToken = access_token.length > 8 
      ? `${access_token.slice(0, 4)}...${access_token.slice(-4)}`
      : 'short'
    
    console.log(`[DEBUG] Environment: ${environment}, Base URL: ${baseUrl}, Token: ${maskedToken}`)

    const response = await fetch(`${baseUrl}/v2/locations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Square-Version': SQUARE_API_VERSION,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Square API error:', response.status, errorData)
      console.error(`[DEBUG] Failed request - Environment: ${environment}, Base URL: ${baseUrl}`)
      
      // Parse Square error response for better feedback
      try {
        const errorJson = JSON.parse(errorData)
        if (errorJson.errors && errorJson.errors.length > 0) {
          const squareError = errorJson.errors[0]
          if (squareError.code === 'UNAUTHORIZED') {
            throw new Error(`Authentication failed: ${squareError.detail}. Environment: ${environment} (${baseUrl}). Please verify your access token is correct and matches the selected environment.`)
          } else {
            throw new Error(`Square API error: ${squareError.category} - ${squareError.detail} (Environment: ${environment})`)
          }
        }
      } catch (parseError) {
        // Fall back to original error if parsing fails
      }
      
      throw new Error(`Square API error: ${response.status} - ${errorData} (Environment: ${environment}, URL: ${baseUrl})`)
    }

    const data = await response.json()
    const locations = data.locations || []

    console.log(`Connection successful: ${locations.length} locations found`)

    // Update integration with success status
    const { error: updateError } = await supabase
      .from('inventory_integrations')
      .update({
        last_success_at: new Date().toISOString(),
        last_error: null
      })
      .eq('id', integrationId)

    if (updateError) {
      console.error('Update error:', updateError)
    }

    return new Response(
      JSON.stringify({ 
        ok: true,
        environment,
        baseUrl,
        maskedToken: access_token.length > 8 ? `${access_token.slice(0, 4)}...${access_token.slice(-4)}` : 'short',
        locations: locations.map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          status: loc.status
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Connection test failed:', error)

    // Try to update integration with error status
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const { integrationId } = await req.json().catch(() => ({}))

      if (integrationId) {
        await supabase
          .from('inventory_integrations')
          .update({
            last_error: error.message
          })
          .eq('id', integrationId)
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError)
    }

    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error.message,
        debug: {
          timestamp: new Date().toISOString(),
          functionName: 'square-test-connection'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  }
})