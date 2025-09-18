import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordResetRequest {
  email: string;
  user_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!employee || employee.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, user_id }: PasswordResetRequest = await req.json();

    if (!email || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Email and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} initiating password reset for user ${user_id} (${email})`);

    // Generate password reset for the user
    const redirectUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/supabase', '') || 'http://localhost:3000'}/password-reset`;
    
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      console.error('Supabase password reset error:', resetError);
      return new Response(
        JSON.stringify({ error: 'Failed to send password reset email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send additional notification email to user
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            Hello,
          </p>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            An administrator has initiated a password reset for your account. You should receive a password reset email shortly with instructions to set a new password.
          </p>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">
            If you did not expect this password reset or have any concerns, please contact your administrator immediately.
          </p>
          <div style="margin: 30px 0; padding: 15px; background: #e3f2fd; border-radius: 4px; border-left: 4px solid #2196f3;">
            <p style="color: #1976d2; font-size: 14px; margin: 0;">
              <strong>Security Notice:</strong> This password reset was initiated by an administrator. If this wasn't expected, please contact support.
            </p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #999; font-size: 14px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    try {
      await resend.emails.send({
        from: 'System Admin <noreply@resend.dev>',
        to: [email],
        subject: 'Password Reset Initiated by Administrator',
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the whole request if notification email fails
    }

    console.log(`Password reset successfully initiated for user ${user_id}`);

    return new Response(
      JSON.stringify({ 
        message: 'Password reset email sent successfully',
        email: email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-password-reset function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});