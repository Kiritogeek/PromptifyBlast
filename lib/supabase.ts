import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Initialisation lazy pour éviter les erreurs lors du build si les variables ne sont pas définies
let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) {
    return _supabase
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Ne pas lancer d'erreur lors du build - retourner un objet qui lancera l'erreur lors de l'utilisation
    // Cela permet au build de réussir même si les variables ne sont pas définies
    return new Proxy({} as SupabaseClient, {
      get() {
        throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required. Please configure them in Vercel environment variables.')
      }
    }) as SupabaseClient
  }
  
  _supabase = createClient(supabaseUrl, supabaseAnonKey)
  return _supabase
}

// Export avec getter pour initialisation lazy - ne s'initialise que lors de l'utilisation
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
}) as SupabaseClient


