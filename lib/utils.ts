/**
 * Utility functions for the application
 * These functions are exported for testing purposes
 */

/**
 * Cleans optimized response by removing intro/outro phrases and quotes
 */
export function cleanOptimizedResponse(text: string | null): string {
  if (!text) return '';
  
  let cleaned = text.trim();
  
  // Enlever les phrases d'introduction communes
  const introPatterns = [
    /^Voici la version optimisée du prompt\s*:?\s*/i,
    /^Here is the optimized prompt\s*:?\s*/i,
    /^Voici le prompt optimisé\s*:?\s*/i,
    /^Here's the optimized prompt\s*:?\s*/i,
    /^Prompt optimisé\s*:?\s*/i,
    /^Optimized prompt\s*:?\s*/i,
    /^Version optimisée\s*:?\s*/i,
    /^Optimized version\s*:?\s*/i,
  ];
  
  for (const pattern of introPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Enlever les phrases de conclusion communes
  const outroPatterns = [
    /\n?\s*Cette version optimisée du prompt.*$/is,
    /\n?\s*This optimized version.*$/is,
    /\n?\s*Cette version.*optimisée.*$/is,
    /\n?\s*This version.*optimized.*$/is,
    /\n?\s*Le prompt optimisé.*$/is,
    /\n?\s*The optimized prompt.*$/is,
  ];
  
  for (const pattern of outroPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Enlever les guillemets en début et fin si présents
  cleaned = cleaned.replace(/^["'`]|["'`]$/g, '');
  
  return cleaned.trim();
}

/**
 * Gets client IP address from request headers
 */
export function getClientIP(request: Request): string {
  // Récupérer l'IP depuis les headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    // x-forwarded-for peut contenir plusieurs IPs, prendre la première
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  // Fallback pour le développement local
  return '127.0.0.1';
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Checks if a value represents unlimited (true, 'true', 1, '1')
 */
export function isUnlimited(value: any): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * Checks if a value represents admin (true, 'true', 1)
 */
export function isAdmin(value: any): boolean {
  return value === true || value === 'true' || value === 1;
}

