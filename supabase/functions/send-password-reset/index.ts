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
  app_url?: string;
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

    const { email, user_id, app_url }: PasswordResetRequest = await req.json();

    if (!email || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Email and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} initiating password reset for user ${user_id} (${email})`);
    console.log(`App URL provided: ${app_url}`);

    // Generate custom reset token
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store the reset token in database
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user_id,
        token: resetToken,
        expires_at: expiresAt.toISOString()
      });

    if (tokenError) {
      console.error('Failed to create reset token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create password reset token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build password reset link using current working domain from app_url or Origin header
    const ensureHttps = (u: string | null | undefined) => {
      if (!u) return '';
      let s = u.trim();
      if (s.startsWith('http://')) s = 'https://' + s.slice(7);
      if (!s.startsWith('http')) s = 'https://' + s;
      return s.replace(/\/+$/, '');
    };

    const originHeader = req.headers.get('origin') || req.headers.get('referer');
    const candidateBase = ensureHttps(app_url) || ensureHttps(originHeader) || 'https://memne.com';
    const encodedToken = encodeURIComponent(resetToken);
    const resetUrl = `${candidateBase}/password-reset?token=${encodedToken}`;
    
    console.log(`Origin header: ${originHeader}`);
    console.log(`Using base URL for reset: ${candidateBase}`);
    console.log(`Generated reset URL: ${resetUrl}`);

    // Send password reset email via Resend
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #1a1a1a; font-size: 28px; font-weight: 600; margin: 0;">🔐 Password Reset</h1>
        </div>
        
        <div style="background-color: #f8fafc; border-radius: 12px; padding: 32px; margin-bottom: 32px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            An administrator has initiated a password reset for your account (<strong>${email}</strong>).
          </p>
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Click the button below to create a new password:
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" 
               target="_blank"
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 16px 32px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      display: inline-block; 
                      font-size: 16px; 
                      font-weight: 600;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              🔐 Reset My Password
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">
              <strong>Button not working?</strong> Copy and paste this link into your browser:
            </p>
            <div style="background-color: #ffffff; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; word-break: break-all;">
              <a href="${resetUrl}" style="color: #3b82f6; font-size: 14px; text-decoration: none;">${resetUrl}</a>
            </div>
          </div>
          
          <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
              ⚠️ This reset link expires in 1 hour for security
            </p>
          </div>
          
          <div style="background-color: #e0f2fe; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #0288d1;">
            <p style="color: #01579b; font-size: 14px; margin: 0;">
              <strong>Troubleshooting:</strong> If the link redirects to a login page, try:
              <br>• Opening the link in an incognito/private browser window
              <br>• Copying the full URL and pasting it in your address bar
              <br>• Clearing your browser cache and cookies
            </p>
          </div>
        </div>
        
        <div style="text-align: center; color: #9ca3af; font-size: 12px; line-height: 1.5;">
          <p style="margin: 0;">
            This password reset was initiated by an administrator.<br>
            If you didn't expect this, please contact support immediately.
          </p>
          <p style="margin: 12px 0 0 0; font-size: 11px; color: #d1d5db;">
            Debug info: ${candidateBase} | Token: ${resetToken.slice(0, 8)}...
          </p>
        </div>
      </div>
    `;

    try {
      await resend.emails.send({
        from: 'Password Reset <noreply@memne.com>',
        to: [email],
        subject: '🔐 Password Reset Request - Action Required',
        html: emailHtml,
        headers: {
          'List-Unsubscribe': '<mailto:noreply@memne.com>',
        }
      });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send password reset email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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