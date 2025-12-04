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
    // Ne pas lancer d'erreur lors du build - retourner un objet qui lancera l'erreur lors de l'utilisation
    // Cela permet au build de réussir même si les variables ne sont pas définies
    return new Proxy({} as SupabaseClient, {
      get() {
        throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Please configure them in Vercel environment variables.')
      }
    }) as SupabaseClient
  }
  
  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
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


