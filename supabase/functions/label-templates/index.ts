import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LabelTemplate {
  id?: string
  profile_id: string
  name: string
  layout: any
  is_active?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    if (req.method === 'POST') {
      let body
      try {
        const bodyText = await req.text()
        if (!bodyText || bodyText.trim() === '') {
          return new Response(
            JSON.stringify({ error: 'Request body is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        body = JSON.parse(bodyText)
      } catch (parseError) {
        console.error('JSON parsing error:', parseError)
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const action = body.action

      if (action === 'list') {
        // List templates for a profile
        const profileId = body.profile_id
        
        if (!profileId) {
          return new Response(
            JSON.stringify({ error: 'profile_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: templates, error } = await supabaseClient
          .from('label_templates')
          .select('*')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false })

        if (error) throw error

        return new Response(
          JSON.stringify({ templates }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'upsert') {
        const template: LabelTemplate = body.template

        if (!template.profile_id || !template.name || !template.layout) {
          return new Response(
            JSON.stringify({ error: 'Missing required template fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) {
          return new Response(
            JSON.stringify({ error: 'User not authenticated' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        let result
        if (template.id) {
          // Update existing template - first get current version
          const { data: currentTemplate } = await supabaseClient
            .from('label_templates')
            .select('version')
            .eq('id', template.id)
            .single()

          const { data, error } = await supabaseClient
            .from('label_templates')
            .update({
              name: template.name,
              layout: template.layout,
              updated_by: user.id,
              version: (currentTemplate?.version || 1) + 1
            })
            .eq('id', template.id)
            .select()
            .single()

          if (error) throw error
          result = data
        } else {
          // Create new template
          const { data, error } = await supabaseClient
            .from('label_templates')
            .insert({
              profile_id: template.profile_id,
              name: template.name,
              layout: template.layout,
              is_active: template.is_active ?? false,
              created_by: user.id
            })
            .select()
            .single()

          if (error) throw error
          result = data
        }

        return new Response(
          JSON.stringify({ template: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'activate') {
        const { template_id, profile_id } = body

        if (!template_id || !profile_id) {
          return new Response(
            JSON.stringify({ error: 'Missing template_id or profile_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Deactivate all templates for this profile
        await supabaseClient
          .from('label_templates')
          .update({ is_active: false })
          .eq('profile_id', profile_id)

        // Activate the selected template
        const { data, error } = await supabaseClient
          .from('label_templates')
          .update({ is_active: true })
          .eq('id', template_id)
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ template: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'delete') {
        const { template_id } = body

        if (!template_id) {
          return new Response(
            JSON.stringify({ error: 'Missing template_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error } = await supabaseClient
          .from('label_templates')
          .delete()
          .eq('id', template_id)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in label-templates function:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})