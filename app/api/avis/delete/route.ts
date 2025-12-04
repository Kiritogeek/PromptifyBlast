import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(req: Request) {
  try {
    if (!req.url) {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
    }
    
    const { searchParams } = new URL(req.url)
    const avisId = searchParams.get('id')
    const deleteAll = searchParams.get('all') === 'true'

    // Vérifier l'authentification
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
    
    // Récupérer l'ID utilisateur depuis les headers
    const userIdFromHeader = req.headers.get('x-user-id')
    
    let user = null
    
    if (userIdFromHeader) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userIdFromHeader)
      user = authUser?.user || null
    } else {
      const { data: { user: cookieUser } } = await supabase.auth.getUser()
      user = cookieUser
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier si l'utilisateur est admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    const userIsAdmin = isAdmin(profile?.is_admin)
    
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Accès refusé. Admin uniquement.' }, { status: 403 })
    }

    // Supprimer un avis spécifique ou tous les avis
    if (deleteAll) {
      // Supprimer tous les avis - utiliser une condition toujours vraie
      const { error } = await supabaseAdmin
        .from('avis')
        .delete()
        .gte('created_at', '1970-01-01') // Condition toujours vraie pour supprimer tout

      if (error) {
        console.error('Error deleting all avis:', error)
        return NextResponse.json({ error: 'Erreur lors de la suppression de tous les avis' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Tous les avis ont été supprimés' })
    } else if (avisId) {
      // Supprimer un avis spécifique
      const { error } = await supabaseAdmin
        .from('avis')
        .delete()
        .eq('id', avisId)

      if (error) {
        console.error('Error deleting avis:', error)
        return NextResponse.json({ error: 'Erreur lors de la suppression de l\'avis' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Avis supprimé avec succès' })
    } else {
      return NextResponse.json({ error: 'ID d\'avis manquant ou paramètre invalide' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error in DELETE /api/avis/delete:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}

