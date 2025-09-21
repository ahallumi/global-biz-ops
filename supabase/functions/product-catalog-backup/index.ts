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

    console.log('Starting product catalog backup...');

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

    const backup = {
      timestamp: new Date().toISOString(),
      backed_up_by: user.id,
      data: {} as any
    };

    // Backup all product-related data
    const tables = [
      'products',
      'product_pos_links', 
      'product_candidates',
      'product_intakes',
      'product_intake_items',
      'intake_files',
      'supplier_products',
      'product_import_runs',
      'product_sync_runs'
    ];

    for (const table of tables) {
      console.log(`Backing up ${table}...`);
      const { data, error } = await supabaseClient
        .from(table)
        .select('*');

      if (error) {
        console.error(`Error backing up ${table}:`, error);
        backup.data[table] = { error: error.message, count: 0 };
      } else {
        backup.data[table] = { records: data, count: data?.length || 0 };
        console.log(`Backed up ${data?.length || 0} records from ${table}`);
      }
    }

    const totalRecords = Object.values(backup.data)
      .reduce((sum: number, table: any) => sum + (table.count || 0), 0);

    console.log(`Backup complete: ${totalRecords} total records`);

    return new Response(JSON.stringify({
      success: true,
      backup,
      summary: {
        total_records: totalRecords,
        tables_backed_up: tables.length,
        timestamp: backup.timestamp
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backup error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});