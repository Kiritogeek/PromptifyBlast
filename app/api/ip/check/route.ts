import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIP, isUnlimited } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ 
        is_premium: false, 
        daily_generations: 0,
        can_generate: true 
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const ipAddress = getClientIP(request)
    const today = new Date().toISOString().split('T')[0]

    // Récupérer ou créer l'entrée pour cette IP
    let { data: ipUsage, error } = await supabase
      .from('ip_usage')
      .select('*')
      .eq('ip_address', ipAddress)
      .single()

    // Si l'entrée n'existe pas, la créer
    if (error && error.code === 'PGRST116') {
      const { data: newUsage, error: insertError } = await supabase
        .from('ip_usage')
        .insert({
          ip_address: ipAddress,
          daily_generations: 0,
          last_reset: today,
          is_premium: false,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating IP usage:', insertError)
        return NextResponse.json({ 
          is_premium: false, 
          daily_generations: 0,
          can_generate: true 
        })
      }

      ipUsage = newUsage
    } else if (error) {
      console.error('Error fetching IP usage:', error)
      return NextResponse.json({ 
        is_premium: false, 
        daily_generations: 0,
        can_generate: true 
      })
    }

    // Vérifier si le compteur doit être réinitialisé (après 24h / changement de jour)
    if (ipUsage && ipUsage.last_reset !== today) {
      const { data: updated, error: resetError } = await supabase
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
        console.error('Error resetting IP daily generations:', resetError)
      } else if (updated) {
        ipUsage = updated
      }
    }

    const hasUnlimited = isUnlimited(ipUsage?.unlimited_prompt)
    const dailyGenerations = ipUsage?.daily_generations || 0
    const canGenerate = hasUnlimited || dailyGenerations < 3

    return NextResponse.json({
      ip_address: ipAddress,
      is_premium: ipUsage?.is_premium || false, // Garder pour compatibilité
      unlimited_prompt: hasUnlimited,
      daily_generations: dailyGenerations,
      can_generate: canGenerate,
      remaining: hasUnlimited ? -1 : Math.max(0, 3 - dailyGenerations)
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


