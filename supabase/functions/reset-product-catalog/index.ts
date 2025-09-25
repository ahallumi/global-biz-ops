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

    const { include_history = false } = await req.json().catch(() => ({}));

    console.log('Starting catalog reset...', { include_history });

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

    const deletionSummary = {
      reset_by: user.id,
      reset_at: new Date().toISOString(),
      deleted_counts: {} as any,
      errors: [] as string[]
    };

    // Delete in correct order to avoid foreign key violations
    const deletionOrder = [
      'intake_reconcile',
      'product_pos_links',
      'product_candidates', 
      'product_intake_items',
      'intake_files',
      'product_intakes',
      'supplier_products',
      'products'
    ];

    // Optionally include sync history
    if (include_history) {
      deletionOrder.push('product_import_runs', 'product_sync_runs');
    }

    console.log('Deletion order:', deletionOrder);

    // Perform deletions in transaction-like manner
    for (const table of deletionOrder) {
      try {
        console.log(`Deleting from ${table}...`);
        
        // First count the records
        const { count, error: countError } = await supabaseClient
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (countError) {
          console.error(`Error counting ${table}:`, countError);
          deletionSummary.errors.push(`Count error on ${table}: ${countError.message}`);
          continue;
        }

        console.log(`Found ${count} records in ${table}`);

        // Delete all records
        const { error: deleteError } = await supabaseClient
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible condition)

        if (deleteError) {
          console.error(`Error deleting from ${table}:`, deleteError);
          deletionSummary.errors.push(`Delete error on ${table}: ${deleteError.message}`);
        } else {
          deletionSummary.deleted_counts[table] = count || 0;
          console.log(`Successfully deleted ${count || 0} records from ${table}`);
        }

      } catch (error) {
        console.error(`Exception deleting from ${table}:`, error);
        deletionSummary.errors.push(`Exception on ${table}: ${(error as any)?.message || 'Unknown error'}`);
      }
    }

    const totalDeleted = Object.values(deletionSummary.deleted_counts)
      .reduce((sum: number, count: any) => sum + count, 0);

    console.log(`Catalog reset complete: ${totalDeleted} total records deleted`);

    if (deletionSummary.errors.length > 0) {
      console.warn('Reset completed with errors:', deletionSummary.errors);
    }

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total_deleted: totalDeleted,
        tables_processed: deletionOrder.length,
        errors_count: deletionSummary.errors.length,
        include_history,
        deleted_counts: deletionSummary.deleted_counts,
        errors: deletionSummary.errors
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Reset error:', error);
    return new Response(JSON.stringify({ 
      error: (error as any)?.message || 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});