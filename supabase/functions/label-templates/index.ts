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
  template_type?: 'visual' | 'html'
  layout?: any
  html_template?: string
  is_active?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log(`[label-templates] ${req.method} request received`)
    console.log(`[label-templates] Content-Type: ${req.headers.get('Content-Type')}`)
    
    // Use service role for database operations, but still get user from JWT if present
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false }
      }
    )

    // Get user from auth header if present (optional)
    let currentUser = null;
    try {
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization') || '' },
          },
        }
      )
      const { data: { user } } = await authClient.auth.getUser()
      currentUser = user
      console.log(`[label-templates] User: ${currentUser?.id || 'anonymous'}`)
    } catch (authError) {
      console.log('[label-templates] No authenticated user, proceeding anonymously')
    }

    if (req.method === 'POST') {
      let body
      try {
        const bodyText = await req.text()
        console.log(`[label-templates] Body length: ${bodyText?.length || 0}`)
        
        if (!bodyText || bodyText.trim() === '') {
          console.error('[label-templates] Empty request body received')
          return new Response(
            JSON.stringify({ error: 'Request body is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        body = JSON.parse(bodyText)
        console.log(`[label-templates] Action: ${body.action}`)
      } catch (parseError) {
        console.error('[label-templates] JSON parsing error:', parseError)
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

        if (!template.profile_id || !template.name) {
          return new Response(
            JSON.stringify({ error: 'Missing required template fields (profile_id, name)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Validate template content based on type
        const templateType = template.template_type || 'visual';
        if (templateType === 'visual' && !template.layout) {
          return new Response(
            JSON.stringify({ error: 'Visual templates must have layout data' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (templateType === 'html' && !template.html_template) {
          return new Response(
            JSON.stringify({ error: 'HTML templates must have html_template data' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`[label-templates] Upserting ${templateType} template: ${template.name} (id: ${template.id || 'new'})`)

        let result
        if (template.id) {
          // Update existing template - first get current version
          const { data: currentTemplate } = await supabaseClient
            .from('label_templates')
            .select('version')
            .eq('id', template.id)
            .single()

          const updateData: any = {
            name: template.name,
            template_type: templateType,
            updated_by: currentUser?.id || null,
            version: (currentTemplate?.version || 1) + 1
          };

          if (templateType === 'visual') {
            updateData.layout = template.layout;
            updateData.html_template = null;
          } else {
            updateData.html_template = template.html_template;
            updateData.layout = null;
          }

          const { data, error } = await supabaseClient
            .from('label_templates')
            .update(updateData)
            .eq('id', template.id)
            .select()
            .single()

          if (error) throw error
          result = data
        } else {
          // Create new template
          const insertData: any = {
            profile_id: template.profile_id,
            name: template.name,
            template_type: templateType,
            is_active: template.is_active ?? false,
            created_by: currentUser?.id || null
          };

          if (templateType === 'visual') {
            insertData.layout = template.layout;
          } else {
            insertData.html_template = template.html_template;
          }

          const { data, error } = await supabaseClient
            .from('label_templates')
            .insert(insertData)
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