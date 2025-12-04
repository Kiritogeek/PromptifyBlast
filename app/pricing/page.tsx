'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté et son statut premium
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)

      // Si l'utilisateur est connecté, vérifier son statut premium
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', session.user.id)
          .single()

        setIsPremium(profile?.is_premium || false)
      } else {
        setIsPremium(false)
      }

      setIsChecking(false)
    }

    checkAuth()

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)

      // Mettre à jour le statut premium si l'utilisateur est connecté
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', session.user.id)
          .single()

        setIsPremium(profile?.is_premium || false)
      } else {
        setIsPremium(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleBuy = async () => {
    // Vérifier que l'utilisateur est connecté
    if (!user) {
      router.push('/login?redirect=/pricing&message=Vous devez être connecté pour acheter Premium')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-email': user.email || '',
        },
      })
      const data = await res.json()
      
      if (!res.ok || data.error) {
        const errorMsg = data.error || data.details || 'Erreur lors de la création de la session de paiement'
        console.error('Erreur API:', data)
        setError(errorMsg)
        setIsLoading(false)
        return
      }
      
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Aucune URL de redirection reçue de Stripe')
        setIsLoading(false)
      }
    } catch (error: any) {
      console.error('Erreur:', error)
      setError(error.message || 'Une erreur est survenue lors de la connexion au serveur')
      setIsLoading(false)
    }
  }

  // Afficher un loader pendant la vérification
  if (isChecking) {
    return (
      <main className="min-h-screen bg-gray-900 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto text-center">
            <div className="text-white">Vérification...</div>
          </div>
        </div>
      </main>
    )
  }

  // Afficher la page même si non connecté (avec message)

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          {/* Premium Plan - Centré */}
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border-2 border-blue-600/70">
            <div className="text-center mb-6">
              <div className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-full text-sm font-semibold mb-2 shadow-lg">
                RECOMMANDÉ
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Premium
              </h1>
              <div className="text-5xl font-bold text-white mb-2">
                5€
              </div>
              <p className="text-gray-300">
                Accès complet à vie
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-gray-300">
                <span className="text-green-500 mr-2">✓</span>
                Générations illimitées
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-500 mr-2">✓</span>
                Mode Basique disponible
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-500 mr-2">✓</span>
                Mode Pro débloqué
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-500 mr-2">✓</span>
                Mode Ultra-Optimisé débloqué
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-500 mr-2">✓</span>
                Sélection du Modèle Cible (ChatGPT, Gemini, Grok)
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-500 mr-2">✓</span>
                Requêtes prioritaires
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-500 mr-2">✓</span>
                Mises à jour futures incluses
              </li>
            </ul>

            {error && (
              <div className="mb-4 p-4 bg-red-900/50 border border-red-600 rounded-lg">
                <p className="text-red-200 text-sm font-semibold mb-1">Erreur</p>
                <p className="text-red-300 text-sm">{error}</p>
                {error.includes('price_') && (
                  <p className="text-red-200 text-xs mt-2">
                    💡 Vérifiez que votre STRIPE_PRICE_ID dans .env.local commence bien par "price_" et redémarrez le serveur.
                  </p>
                )}
                {error.includes('connecté') && (
                  <Link
                    href="/login?redirect=/pricing"
                    className="text-blue-400 hover:text-blue-300 underline text-sm mt-2 inline-block"
                  >
                    Se connecter maintenant →
                  </Link>
                )}
              </div>
            )}

            {isPremium ? (
              <button
                disabled
                className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 rounded-xl font-semibold text-lg cursor-not-allowed opacity-90 shadow-lg"
              >
                Premium ✓
              </button>
            ) : !user ? (
              <Link
                href="/login?redirect=/pricing"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                Connectez-vous pour passer Premium
              </Link>
            ) : (
              <button
                onClick={handleBuy}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
              >
                {isLoading ? 'Redirection vers Stripe...' : 'Acheter Premium – 5€'}
              </button>
            )}

              <p className="text-center text-sm text-gray-400 mt-4">
                Paiement sécurisé via Stripe
              </p>
          </div>
        </div>
      </div>
    </main>
  )
}

