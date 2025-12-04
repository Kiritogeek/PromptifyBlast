import { NextResponse } from 'next/server'
import { getClientIP, isUnlimited } from '@/lib/utils'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ipAddress = getClientIP(request)
    const today = new Date().toISOString().split('T')[0]
    
    // Log pour déboguer
    console.log('[IP/CHECK] IP détectée:', ipAddress, 'Date:', today)

    // Utiliser supabaseAdmin pour bypass RLS et avoir les mêmes données que /api/generate
    let { data: ipUsage, error } = await supabaseAdmin
      .from('ip_usage')
      .select('*')
      .eq('ip_address', ipAddress)
      .maybeSingle()

    // Log pour déboguer
    console.log('[IP/CHECK] IP usage trouvé:', ipUsage ? `daily_generations=${ipUsage.daily_generations}, last_reset=${ipUsage.last_reset}` : 'aucun')

    // Si l'entrée n'existe pas, retourner 0 générations (elle sera créée lors de la première génération)
    if (!ipUsage) {
      console.log('[IP/CHECK] Aucune entrée IP trouvée, retourner 0 générations')
      return NextResponse.json({
        ip_address: ipAddress,
        is_premium: false,
        unlimited_prompt: false,
        daily_generations: 0,
        can_generate: true,
        remaining: 3
      })
    }

    if (error && error.code !== 'PGRST116') {
      console.error('[IP/CHECK] Error fetching IP usage:', error)
      return NextResponse.json({ 
        is_premium: false, 
        daily_generations: 0,
        can_generate: true 
      })
    }

    // Vérifier si le compteur doit être réinitialisé (après 24h / changement de jour)
    let dailyGenerations = ipUsage.daily_generations || 0
    if (ipUsage.last_reset !== today) {
      // Réinitialiser le compteur dans la BDD
      const { data: updated, error: resetError } = await supabaseAdmin
        .from('ip_usage')
        .update({ 
          daily_generations: 0, 
          last_reset: today,
          updated_at: new Date().toISOString()
        })
        .eq('ip_address', ipAddress)
        .select()
        .single()

      if (resetError) {
        console.error('[IP/CHECK] Error resetting IP daily generations:', resetError)
      } else if (updated) {
        ipUsage = updated
        dailyGenerations = 0
      } else {
        dailyGenerations = 0
      }
    }

    const hasUnlimited = isUnlimited(ipUsage.unlimited_prompt)
    const canGenerate = hasUnlimited || dailyGenerations < 3
    const remaining = hasUnlimited ? -1 : Math.max(0, 3 - dailyGenerations)

    // Log pour déboguer
    console.log('[IP/CHECK] Résultat:', { 
      ipAddress, 
      dailyGenerations, 
      hasUnlimited, 
      remaining, 
      canGenerate 
    })

    return NextResponse.json({
      ip_address: ipAddress,
      is_premium: ipUsage.is_premium || false, // Garder pour compatibilité
      unlimited_prompt: hasUnlimited,
      daily_generations: dailyGenerations,
      can_generate: canGenerate,
      remaining: remaining
    })
  } catch (error) {
    console.error('IP check error:', error)
    return NextResponse.json({ 
      is_premium: false, 
      daily_generations: 0,
      can_generate: true 
    })
  }
}


