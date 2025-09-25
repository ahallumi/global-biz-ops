import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LabelProfile {
  id: string;
  label_name: string;
  template_id: string;
  width_mm: number;
  height_mm: number;
  dpi: number;
  margin_mm: number;
}

interface ConfigUpdate {
  active_profile_id?: string;
  profiles?: LabelProfile[];
  print_on_enter?: boolean;
  beep_on_success?: boolean;
  preview_before_print?: boolean;
  default_printer_id?: string | null;
}

function validateProfile(profile: LabelProfile): string[] {
  const errors: string[] = [];
  
  if (!profile.id || profile.id.trim() === '') {
    errors.push('Profile ID is required');
  }
  
  if (!profile.label_name || profile.label_name.trim() === '') {
    errors.push('Label name is required');
  }
  
  if (profile.width_mm < 10 || profile.width_mm > 200) {
    errors.push('Width must be between 10 and 200 mm');
  }
  
  if (profile.height_mm < 10 || profile.height_mm > 200) {
    errors.push('Height must be between 10 and 200 mm');
  }
  
  if (![203, 300, 600].includes(profile.dpi)) {
    errors.push('DPI must be 203, 300, or 600');
  }
  
  if (profile.margin_mm < 0 || profile.margin_mm > 10) {
    errors.push('Margin must be between 0 and 10 mm');
  }
  
  return errors;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: isAdminResult, error: adminError } = await supabaseClient
      .rpc('is_admin', { p_uid: user.id });

    if (adminError || !isAdminResult) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates: ConfigUpdate = await req.json();
    console.log('Updating label print config:', updates);

    // Validate profiles if provided
    if (updates.profiles) {
      const validationErrors: string[] = [];
      for (const profile of updates.profiles) {
        const errors = validateProfile(profile);
        validationErrors.push(...errors);
      }
      
      if (validationErrors.length > 0) {
        return new Response(JSON.stringify({ 
          error: 'Validation failed', 
          details: validationErrors 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get current config
    const { data: currentSettings, error: getError } = await supabaseClient
      .from('system_settings')
      .select('value')
      .eq('key', 'label_print.config')
      .maybeSingle();

    if (getError) {
      console.error('Error fetching current config:', getError);
      return new Response(JSON.stringify({ error: getError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentConfig = currentSettings?.value || {};
    const newConfig = { ...currentConfig, ...updates };

    // Validate that active_profile_id exists in profiles
    if (newConfig.active_profile_id && newConfig.profiles) {
      const profileExists = newConfig.profiles.some(
        (profile: LabelProfile) => profile.id === newConfig.active_profile_id
      );
      
      if (!profileExists) {
        return new Response(JSON.stringify({ 
          error: 'Active profile ID must exist in profiles list' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Update the configuration
    const { error: updateError } = await supabaseClient
      .from('system_settings')
      .upsert({
        key: 'label_print.config',
        value: newConfig
      });

    if (updateError) {
      console.error('Error updating config:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Label print config updated successfully');

    return new Response(JSON.stringify({ 
      success: true,
      config: newConfig
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-label-print-config:', error);
    return new Response(JSON.stringify({ 
      error: (error as any)?.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});