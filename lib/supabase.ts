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
    console.error('❌ Variables d\'environnement Supabase manquantes:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
    console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗')
    console.error('📝 Pour configurer dans Vercel:')
    console.error('   1. Allez dans votre projet Vercel')
    console.error('   2. Settings > Environment Variables')
    console.error('   3. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.error('   4. Redéployez l\'application')
    
    return new Proxy({} as SupabaseClient, {
      get(_target, prop) {
        // Ne pas lancer d'erreur pour certaines propriétés qui sont souvent vérifiées
        if (prop === 'auth') {
          return new Proxy({}, {
            get() {
              throw new Error('Supabase n\'est pas configuré. Veuillez configurer NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans les variables d\'environnement Vercel.')
            }
          })
        }
        throw new Error('Supabase n\'est pas configuré. Veuillez configurer NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans les variables d\'environnement Vercel.')
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


