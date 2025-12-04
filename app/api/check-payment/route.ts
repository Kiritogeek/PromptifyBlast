import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
})

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID manquant' },
        { status: 400 }
      )
    }

    // Récupérer la session Stripe pour vérifier le statut
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Vérifier que le paiement est bien complété
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { 
          paid: false, 
          payment_status: session.payment_status,
          message: 'Paiement non complété'
        },
        { status: 200 }
      )
    }

    // Récupérer l'ID utilisateur depuis les metadata de la session Stripe
    // (on l'a stocké lors de la création de la session dans /api/checkout)
    const userId = session.metadata?.user_id

    if (!userId) {
      console.error('Aucun user_id trouvé dans les metadata de la session Stripe')
      return NextResponse.json(
        { error: 'Impossible de déterminer l\'utilisateur. Le paiement a peut-être été effectué sans être connecté.' },
        { status: 400 }
      )
    }


    // Vérifier si le premium est déjà activé
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .single()

    // Si le premium n'est pas encore activé, l'activer
    if (!profile?.is_premium) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          is_premium: true,
          unlimited_prompt: true, // Activer les générations illimitées
          premium_until: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        })

      if (profileError) {
        console.error('Error updating user profile:', profileError)
        return NextResponse.json(
          { error: 'Erreur lors de l\'activation du premium' },
          { status: 500 }
        )
      }

    } else {
    }

    return NextResponse.json({
      paid: true,
      premium_activated: true,
      payment_status: session.payment_status,
      message: 'Paiement confirmé et premium activé'
    })
  } catch (error: any) {
    console.error('Erreur lors de la vérification du paiement:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

