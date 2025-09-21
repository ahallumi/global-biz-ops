import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * Flexible hook to extract password reset token from either:
 * 1. Regular URL query params: /password-reset?token=abc123
 * 2. Hash route query params: /#/password-reset?token=abc123
 * 
 * This ensures the password reset page works with both routing styles.
 */
export function useResetToken(): string | null {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  // 1) Try normal query string first
  const urlToken = searchParams.get('token');
  if (urlToken) {
    return urlToken;
  }
  
  // 2) Try hash route query params: "#/password-reset?token=..."
  if (location.hash) {
    try {
      // Remove leading # and parse as URL to extract search params
      const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
      
      // Create a fake URL so we can use URLSearchParams to parse it
      const fakeUrl = new URL(hash, window.location.origin);
      const hashToken = new URLSearchParams(fakeUrl.search).get('token');
      
      if (hashToken) {
        return hashToken;
      }
    } catch (error) {
      // Ignore parsing errors - just means no valid token in hash
      console.debug('Could not parse token from hash:', error);
    }
  }
  
  return null;
}