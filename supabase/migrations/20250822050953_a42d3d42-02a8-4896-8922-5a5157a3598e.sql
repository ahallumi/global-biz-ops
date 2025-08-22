-- Create a safer decryption function that keeps secrets in database until needed
CREATE OR REPLACE FUNCTION public.decrypt_secret(cipher_b64 bytea, p_crypt_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Decrypt the secret using the provided key
  RETURN pgp_sym_decrypt(cipher_b64, p_crypt_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL on decryption failure for proper error handling
    RETURN NULL;
END;
$function$;