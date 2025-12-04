import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ user: null, profile: null })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    } as any)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ user: null, profile: null })
    }

    // Récupérer le profil
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return NextResponse.json({ user, profile: null })
    }

    // Vérifier si le compteur doit être réinitialisé (après 24h / changement de jour)
    const today = new Date().toISOString().split('T')[0]
    if (profile.last_reset !== today) {
      const { error: resetError } = await supabase
        .from('profiles')
        .update({ 
          daily_generations: 0, 
          last_reset: today,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      if (resetError) {
        console.error('Error resetting daily generations in auth check:', resetError)
      } else {
        // Mettre à jour le profil localement
        profile.daily_generations = 0
        profile.last_reset = today
      }
    }

    return NextResponse.json({ user, profile })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json({ user: null, profile: null })
  }
}
