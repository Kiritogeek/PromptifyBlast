import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

// Initialisation lazy de Stripe pour éviter les erreurs lors du build
function getStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-11-17.clover',
  })
}

// Le webhook est optionnel - on utilise maintenant /api/check-payment pour activer le premium
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Si STRIPE_WEBHOOK_SECRET n'est pas configuré, le webhook n'est pas utilisé
  // On utilise maintenant /api/check-payment pour activer le premium
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook non configuré. Utilisez /api/check-payment pour activer le premium.' },
      { status: 400 }
    )
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    // Gérer l'événement de paiement réussi
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      // Récupérer l'email du client depuis la session
      const customerEmail = session.customer_email || session.customer_details?.email
      const userId = session.metadata?.user_id
      const ipAddress = session.metadata?.ip_address

      if (!customerEmail) {
        console.error('No customer email found in session')
        return NextResponse.json({ error: 'No email found' }, { status: 400 })
      }

      // L'utilisateur DOIT être connecté pour payer (vérifié dans checkout)
      if (!userId) {
        console.error('No user_id in session metadata - payment should not have been possible')
        return NextResponse.json({ error: 'No user ID found' }, { status: 400 })
      }

      // Activer le premium pour l'utilisateur connecté
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
        return NextResponse.json({ error: 'Error updating profile' }, { status: 500 })
      }


    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

