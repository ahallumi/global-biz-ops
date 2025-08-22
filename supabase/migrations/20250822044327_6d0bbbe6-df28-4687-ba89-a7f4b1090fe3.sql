-- Fix the search path for credential encryption functions to include extensions schema
-- This will allow pgp_sym_encrypt and pgp_sym_decrypt to be found

CREATE OR REPLACE FUNCTION public.save_encrypted_credentials(p_integration_id uuid, p_access_token text, p_crypt_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  INSERT INTO integration_credentials (integration_id, secret_ciphertext)
  VALUES (p_integration_id, pgp_sym_encrypt(p_access_token, p_crypt_key))
  ON CONFLICT (integration_id)
  DO UPDATE SET 
    secret_ciphertext = pgp_sym_encrypt(p_access_token, p_crypt_key),
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_decrypted_credentials(p_integration_id uuid, p_crypt_key text)
 RETURNS TABLE(access_token text, environment text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    pgp_sym_decrypt(ic.secret_ciphertext, p_crypt_key) as access_token,
    ii.environment
  FROM integration_credentials ic
  JOIN inventory_integrations ii ON ii.id = ic.integration_id
  WHERE ic.integration_id = p_integration_id;
END;
$function$;