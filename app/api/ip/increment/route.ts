import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientIP } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const ipAddress = getClientIP(request)
    const today = new Date().toISOString().split('T')[0]

    // Récupérer l'entrée actuelle
    let { data: ipUsage } = await supabase
      .from('ip_usage')
      .select('*')
      .eq('ip_address', ipAddress)
      .single()

    // Si l'entrée n'existe pas, la créer avec 1 génération
    if (!ipUsage) {
      const { data: newUsage, error: insertError } = await supabase
        .from('ip_usage')
        .insert({
          ip_address: ipAddress,
          daily_generations: 1,
          last_reset: today,
          is_premium: false,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating IP usage:', insertError)
        return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
      }

      return NextResponse.json({ success: true, count: 1 })
    }

    // Vérifier si le compteur doit être réinitialisé
    let dailyGenerations = ipUsage.daily_generations
    if (ipUsage.last_reset !== today) {
      dailyGenerations = 0
    }

    // Incrémenter le compteur
    const { error: updateError } = await supabase
      .from('ip_usage')
      .update({
        daily_generations: dailyGenerations + 1,
        last_reset: today,
        updated_at: new Date().toISOString(),
      })
      .eq('ip_address', ipAddress)

    if (updateError) {
      console.error('Error updating IP usage:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: dailyGenerations + 1 })
  } catch (error) {
    console.error('Increment error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}


