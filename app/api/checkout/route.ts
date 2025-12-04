import { NextResponse } from "next/server";
import Stripe from "stripe";

// Initialiser Stripe seulement si la clé existe
let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-11-20.acacia",
    });
  } catch (error) {
    console.error("Erreur lors de l'initialisation de Stripe:", error);
  }
}

export async function POST(req: Request) {
  try {
    // Vérifier que l'utilisateur est connecté (OBLIGATOIRE)
    const userId = req.headers.get('x-user-id')
    const userEmail = req.headers.get('x-user-email')

    if (!userId || !userEmail) {
      console.error("Tentative de paiement sans connexion");
      return NextResponse.json(
        { error: "Vous devez être connecté pour effectuer un achat. Veuillez vous connecter d'abord." },
        { status: 401 }
      );
    }

    // Vérifications Stripe
    if (!stripe) {
      console.error("Stripe non initialisé. Vérifiez STRIPE_SECRET_KEY dans .env.local");
      return NextResponse.json(
        { error: "Stripe non configuré. Vérifiez votre STRIPE_SECRET_KEY dans .env.local" },
        { status: 500 }
      );
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("STRIPE_SECRET_KEY manquante dans .env.local");
      return NextResponse.json(
        { error: "Stripe secret key not configured. Vérifiez votre .env.local" },
        { status: 500 }
      );
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      console.error("STRIPE_PRICE_ID manquant dans .env.local");
      return NextResponse.json(
        { error: "Stripe price ID not configured. Ajoutez STRIPE_PRICE_ID dans .env.local" },
        { status: 500 }
      );
    }

    // Vérifier que c'est bien un Price ID (commence par price_)
    if (!priceId.startsWith('price_')) {
      console.error("STRIPE_PRICE_ID invalide:", priceId);
      return NextResponse.json(
        { 
          error: `STRIPE_PRICE_ID invalide. Vous avez mis "${priceId}" mais il faut un Price ID qui commence par "price_". Allez sur Stripe Dashboard > Products > votre produit > copiez le "Price ID" (pas le Product ID).` 
        },
        { status: 500 }
      );
    }


    const session = await stripe.checkout.sessions.create({
      mode: "payment", // One-time payment
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: userEmail, // Email de l'utilisateur connecté
      metadata: {
        user_id: userId, // ID utilisateur (OBLIGATOIRE pour associer le premium)
        user_email: userEmail, // Email pour référence
      },
      // Détecter automatiquement l'URL : production (Vercel/Netlify) ou développement local
      // Vercel fournit automatiquement VERCEL_URL, Netlify fournit DEPLOY_PRIME_URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
        || process.env.VERCEL_URL 
        || process.env.DEPLOY_PRIME_URL
        || (process.env.NEXT_PUBLIC_SITE_URL && new URL(process.env.NEXT_PUBLIC_SITE_URL).origin)
        || (process.env.NODE_ENV === 'production' ? 'https://promptifyblast.com' : 'http://localhost:3000')
      
      // Ajouter le protocole si manquant (Vercel/Netlify ne l'incluent pas toujours)
      const appUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
      
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("Erreur Stripe:", {
      message: e.message,
      type: e.type,
      code: e.code,
      statusCode: e.statusCode,
      raw: e.raw
    });
    
    // Message d'erreur plus détaillé
    let errorMessage = "Erreur lors de la création de la session Stripe";
    if (e.message) {
      errorMessage = e.message;
    } else if (e.type) {
      errorMessage = `Erreur Stripe: ${e.type}`;
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: e.type || "Unknown error",
        code: e.code || "NO_CODE"
      },
      { status: 500 }
    );
  }
}

