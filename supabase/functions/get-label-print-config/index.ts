import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { station_id } = await req.json().catch(() => ({}));

    console.log('Fetching label print config for station:', station_id);

    // Get base configuration
    const { data: settings, error: settingsError } = await supabaseClient
      .from('system_settings')
      .select('value')
      .eq('key', 'label_print.config')
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(JSON.stringify({ 
        error: settingsError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let config = settings?.value || {
      active_profile_id: 'brother-29x90',
      profiles: [],
      print_on_enter: true,
      beep_on_success: true,
      preview_before_print: false,
      default_printer_id: null
    };

    // Apply station overrides if station_id is provided
    if (station_id) {
      const { data: overrides, error: overridesError } = await supabaseClient
        .from('label_print_overrides')
        .select('*')
        .eq('station_id', station_id);

      if (overridesError) {
        console.error('Error fetching overrides:', overridesError);
      } else if (overrides && overrides.length > 0) {
        const override = overrides[0];
        config = {
          ...config,
          active_profile_id: override.profile_id,
          default_printer_id: override.default_printer_id || config.default_printer_id
        };
        console.log('Applied station override:', override);
      }
    }

    return new Response(JSON.stringify({ config }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-label-print-config:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});