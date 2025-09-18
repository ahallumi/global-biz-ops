-- Create admin function to update user password with custom token validation
CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  user_id UUID,
  new_password TEXT,
  reset_token TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_record RECORD;
BEGIN
  -- Validate the reset token
  SELECT * INTO token_record
  FROM password_reset_tokens 
  WHERE token = reset_token 
    AND user_id = admin_update_user_password.user_id
    AND expires_at > now()
    AND used_at IS NULL;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired reset token';
  END IF;
  
  -- Update user password using auth.users (requires service role)
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = user_id;
  
  -- Mark token as used
  UPDATE password_reset_tokens 
  SET used_at = now() 
  WHERE token = reset_token;
END;
$$;