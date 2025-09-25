import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  employee_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: adminEmployee } = await supabase
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminEmployee || adminEmployee.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { employee_id }: InviteRequest = await req.json();

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employee_id)
      .single();

    if (employeeError || !employee) {
      console.error('Employee not found:', employeeError);
      return new Response(JSON.stringify({ error: 'Employee not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!employee.email) {
      return new Response(JSON.stringify({ error: 'Employee has no email address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate secure setup token (32 characters)
    const setupToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72); // 72 hour expiry

    // Update employee with setup token
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        setup_token: setupToken,
        setup_token_expires: expiresAt.toISOString(),
        invited_at: new Date().toISOString()
      })
      .eq('id', employee_id);

    if (updateError) {
      console.error('Error updating employee:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to generate invite token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send invitation email
    const setupUrl = `${req.headers.get('origin')}/employee-setup?token=${setupToken}`;
    
    const { error: emailError } = await resend.emails.send({
      from: 'No Reply <noreply@resend.dev>',
      to: [employee.email],
      subject: 'Complete Your Account Setup',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; margin-bottom: 24px;">Account Setup Invitation</h2>
          
          <p style="color: #555; margin-bottom: 16px;">
            Hello ${employee.first_name || employee.full_name},
          </p>
          
          <p style="color: #555; margin-bottom: 16px;">
            Your administrator has set up online access for your employee account. 
            Please click the link below to complete your account setup and create your password.
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${setupUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold;
                      display: inline-block;">
              Complete Account Setup
            </a>
          </div>
          
          <p style="color: #555; font-size: 14px; margin-bottom: 8px;">
            This link will expire in 72 hours for security purposes.
          </p>
          
          <p style="color: #555; font-size: 14px;">
            If you didn't expect this invitation, please contact your administrator.
          </p>
          
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="color: #888; font-size: 12px;">
            If the button above doesn't work, copy and paste this link into your browser:<br>
            <span style="word-break: break-all;">${setupUrl}</span>
          </p>
        </div>
      `
    });

    if (emailError) {
      console.error('Email send failed:', emailError);
      return new Response(JSON.stringify({ error: 'Failed to send invitation email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Setup invitation sent to ${employee.email} for employee ${employee.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Invitation sent successfully',
      invited_at: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in send-employee-invite function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);