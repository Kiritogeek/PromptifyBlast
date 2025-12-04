import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isAdmin, isUnlimited } from '@/lib/utils'

const ADMIN_EMAIL = 'louisbasnier@gmail.com'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Méthode 1: Récupérer l'ID depuis les headers (plus fiable)
    const userIdFromHeader = req.headers.get('x-user-id')
    
    // Méthode 2: Depuis les cookies (fallback)
    const cookieStore = cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    } as any)
    
    // Vérifier si l'utilisateur est connecté
    let user = null
    let userError = null
    
    if (userIdFromHeader) {
      // Si on a l'ID depuis les headers, récupérer l'utilisateur directement
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userIdFromHeader)
      user = authUser?.user || null
    } else {
      // Sinon, essayer depuis les cookies
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
      user = cookieUser
      userError = cookieError
    }
    
    // Si pas d'utilisateur, retourner une erreur
    if (!user) {
      console.error('Auth error in /api/avis:', userError || 'No user found')
      console.log('userIdFromHeader:', userIdFromHeader)
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer le profil pour vérifier is_admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json({ error: 'Erreur lors de la vérification du profil' }, { status: 500 })
    }

    // Vérifier si l'utilisateur est admin
    const userIsAdmin = isAdmin(profile?.is_admin)
    
    if (!userIsAdmin) {
      console.log(`Accès refusé pour ${user.email} - Admin uniquement`)
      return NextResponse.json({ error: 'Accès refusé. Admin uniquement.' }, { status: 403 })
    }

    console.log('Admin authentifié, récupération des avis...')

    // Récupérer tous les avis avec supabaseAdmin pour bypasser RLS
    const { data: avis, error } = await supabaseAdmin
      .from('avis')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching avis:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      
      // Si la table n'existe pas, retourner un message clair
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ 
          error: 'La table "avis" n\'existe pas encore. Veuillez exécuter le script SQL dans Supabase.',
          details: error.message 
        }, { status: 500 })
      }
      
      return NextResponse.json({ error: 'Erreur lors de la récupération des avis', details: error.message }, { status: 500 })
    }

    console.log(`Nombre d'avis trouvés: ${avis?.length || 0}`)
    if (avis && avis.length > 0) {
      console.log('Premier avis:', avis[0])
    } else {
      console.log('Aucun avis dans la base de données')
    }

    // Récupérer les statuts premium et emails pour chaque utilisateur
    // Optimisation : récupérer tous les profils en une seule requête pour les avis avec user_id
    const userIds = [...new Set((avis || []).filter(a => a.user_id).map(a => a.user_id))]
    
    let profilesMap = new Map()
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, unlimited_prompt')
        .in('id', userIds)
      
      if (profilesError) {
        console.error('[AVIS API] Erreur lors de la récupération des profils:', profilesError)
      } else if (profiles) {
        profiles.forEach(profile => {
          profilesMap.set(profile.id, profile)
        })
      }
    }

    // Traiter chaque avis
    const avisWithPremium = (avis || []).map((item) => {
      let email = item.user_email || null
      let isPremium = false

      // Si on a un user_id, récupérer depuis le map des profils
      if (item.user_id) {
        const profile = profilesMap.get(item.user_id)
        
        if (profile) {
          // Récupérer l'email depuis le profil si disponible
          if (profile.email) {
            email = profile.email
          }
          
          // Récupérer le statut premium
          isPremium = isUnlimited(profile.unlimited_prompt)
        }
      }

      // Utiliser l'email stocké dans l'avis si on n'en a pas trouvé ailleurs
      const finalEmail = email || item.user_email || null

      return {
        ...item,
        user_email: finalEmail,
        isPremium,
      }
    })

    return NextResponse.json({ avis: avisWithPremium })
  } catch (error: any) {
    console.error('Error in GET /api/avis:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

