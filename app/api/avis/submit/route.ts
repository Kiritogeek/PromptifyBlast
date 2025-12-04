import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isUnlimited } from '@/lib/utils'

export async function POST(req: Request) {
  try {
    const { content, tag } = await req.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Le contenu de l\'avis est requis' }, { status: 400 })
    }

    if (content.length > 250) {
      return NextResponse.json({ error: 'L\'avis ne peut pas dépasser 250 caractères' }, { status: 400 })
    }

    if (tag && tag.trim().length > 15) {
      return NextResponse.json({ error: 'Le tag ne peut pas dépasser 15 caractères' }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    })
    
    // Vérifier si l'utilisateur est connecté
    console.log('[AVIS SUBMIT] Début de la soumission, vérification de l\'authentification...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('[AVIS SUBMIT] Résultat auth.getUser():', { 
      hasUser: !!user, 
      userId: user?.id, 
      userEmail: user?.email,
      error: userError?.message 
    })
    
    let userId: string | null = null
    let userEmail: string | null = null
    let isPremium: boolean = false

    if (!userError && user) {
      userId = user.id
      userEmail = user.email || null
      
      console.log(`[AVIS SUBMIT] Utilisateur connecté: id=${userId}, email=${userEmail}`)
      
      // Récupérer le profil pour obtenir l'email et le statut premium
      if (userId) {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('email, unlimited_prompt')
          .eq('id', userId)
          .maybeSingle()
        
        if (profileError) {
          console.error('[AVIS SUBMIT] Erreur lors de la récupération du profil:', profileError)
        }
        
        // Récupérer l'email depuis le profil si disponible
        if (profile?.email) {
          userEmail = profile.email
          console.log(`[AVIS SUBMIT] Email récupéré depuis le profil: ${userEmail}`)
        }
        
        // Récupérer le statut premium
        isPremium = isUnlimited(profile?.unlimited_prompt)
        
        console.log(`[AVIS SUBMIT] Utilisateur ${userId}: email=${userEmail}, isPremium=${isPremium}`)
      }
    } else {
      console.log('[AVIS SUBMIT] Utilisateur non connecté, avis anonyme', { error: userError?.message })
    }

    // Si l'utilisateur est connecté et veut ajouter/modifier un tag, supprimer l'ancien tag d'abord
    if (userId && tag && tag.trim()) {
      // Supprimer tous les tags existants de cet utilisateur
      await supabaseAdmin
        .from('avis')
        .update({
          tag: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .not('tag', 'is', null)
    }

    // Vérifier si l'utilisateur a déjà un avis
    let existingAvis = null
    if (userId) {
      const { data } = await supabaseAdmin
        .from('avis')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      existingAvis = data
    }

    if (existingAvis) {
      // Mettre à jour l'avis existant (y compris l'email si disponible)
      const updateData: any = {
        content: content.trim(),
        tag: tag && tag.trim() ? tag.trim() : null,
        updated_at: new Date().toISOString(),
      }
      
      // Toujours mettre à jour l'email si on l'a (au cas où il aurait changé)
      if (userEmail) {
        updateData.user_email = userEmail
      }
      
      const { error } = await supabaseAdmin
        .from('avis')
        .update(updateData)
        .eq('user_id', userId)

      if (error) {
        console.error('Error updating avis:', error)
        return NextResponse.json({ error: 'Erreur lors de la mise à jour de l\'avis' }, { status: 500 })
      }
      
      console.log(`[AVIS SUBMIT] Avis mis à jour pour user_id=${userId}, email=${userEmail}`)
    } else {
      // Créer un nouvel avis
      const insertData: any = {
        user_id: userId,
        user_email: userEmail,
        content: content.trim(),
        tag: tag && tag.trim() ? tag.trim() : null,
      }
      
      const { error } = await supabaseAdmin
        .from('avis')
        .insert(insertData)

      if (error) {
        console.error('Error inserting avis:', error)
        return NextResponse.json({ error: 'Erreur lors de l\'envoi de l\'avis' }, { status: 500 })
      }
      
      console.log(`[AVIS SUBMIT] Nouvel avis créé pour user_id=${userId}, email=${userEmail}`)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in POST /api/avis/submit:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}

