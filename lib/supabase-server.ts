import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Client avec service role key pour les opérations serveur (webhooks, etc.)
// Initialisation lazy pour éviter les erreurs lors du build si les variables ne sont pas définies
let _supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) {
    return _supabaseAdmin
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    // Log détaillé pour aider au débogage en production
    console.error('[SUPABASE_ADMIN] Variables d\'environnement manquantes:', {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? '✓ Définie' : '✗ Manquante',
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? '✓ Définie' : '✗ Manquante',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    })
    
    // Ne pas lancer d'erreur lors du build - retourner un objet qui lancera l'erreur lors de l'utilisation
    // Cela permet au build de réussir même si les variables ne sont pas définies
    return new Proxy({} as SupabaseClient, {
      get(_target, prop) {
        // Pour certaines propriétés souvent vérifiées, retourner un proxy qui log l'erreur
        if (prop === 'from' || prop === 'auth') {
          return new Proxy({}, {
            get() {
              const errorMsg = 'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Please configure them in Vercel environment variables and redeploy.'
              console.error('[SUPABASE_ADMIN]', errorMsg)
              throw new Error(errorMsg)
            }
          })
        }
        const errorMsg = 'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Please configure them in Vercel environment variables and redeploy.'
        console.error('[SUPABASE_ADMIN]', errorMsg)
        throw new Error(errorMsg)
      }
    }) as SupabaseClient
  }
  
  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  console.log('[SUPABASE_ADMIN] Client initialisé avec succès')
  return _supabaseAdmin
}

// Export avec getter pour initialisation lazy - ne s'initialise que lors de l'utilisation
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const admin = getSupabaseAdmin()
    const value = (admin as any)[prop]
    return typeof value === 'function' ? value.bind(admin) : value
  }
}) as SupabaseClient


