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
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    let subscription: { unsubscribe: () => void } | null = null

    // Fonction pour arrêter le chargement de manière sécurisée
    const stopChecking = () => {
      if (isMounted) {
        setIsChecking(false)
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }
    }

    // Timeout de sécurité réduit à 2 secondes pour éviter le blocage
    timeoutId = setTimeout(() => {
      console.warn('[PRICING] Timeout de vérification (2s), arrêt du chargement')
      stopChecking()
      if (isMounted) {
        setUser(null)
        setIsPremium(false)
      }
    }, 2000) // 2 secondes maximum

    // Vérifier si l'utilisateur est connecté et son statut premium
    const checkAuth = async () => {
      // Wrapper toute la logique dans un try-catch global pour capturer toutes les erreurs
      try {
        // Vérifier si Supabase est disponible en testant une propriété simple
        // Si Supabase n'est pas configuré, le Proxy lancera une erreur synchrone
        let supabaseAvailable = false
        try {
          // Tester si supabase.auth existe - cela peut lancer une erreur si non configuré
          const testAuth = supabase.auth
          if (testAuth && typeof testAuth === 'object') {
            supabaseAvailable = true
          }
        } catch (e: any) {
          // Supabase n'est pas configuré, le Proxy a lancé une erreur
          console.warn('[PRICING] Supabase non configuré:', e?.message || 'Variables d\'environnement manquantes')
          stopChecking()
          if (isMounted) {
            setUser(null)
            setIsPremium(false)
          }
          return
        }

        if (!supabaseAvailable) {
          console.warn('[PRICING] Supabase non disponible, affichage de la page sans authentification')
          stopChecking()
          return
        }

        // Essayer de récupérer la session avec un timeout
        let session = null
        
        try {
          const sessionPromise = supabase.auth.getSession()
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 1500)
          )
          
          const result = await Promise.race([sessionPromise, timeoutPromise]) as any
          
          if (result?.data?.session) {
            session = result.data.session
          }
        } catch (error: any) {
          // Erreur normale si Supabase n'est pas configuré ou timeout
          console.warn('[PRICING] Impossible de récupérer la session:', error?.message || 'Timeout')
        }
        
        if (!isMounted) {
          stopChecking()
          return
        }

        setUser(session?.user ?? null)

        // Si l'utilisateur est connecté, vérifier son statut premium
        if (session?.user) {
          try {
            const profilePromise = supabase
              .from('profiles')
              .select('is_premium')
              .eq('id', session.user.id)
              .single()
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 1000)
            )
            
            const profileResult = await Promise.race([profilePromise, timeoutPromise]) as any

            if (!isMounted) {
              stopChecking()
              return
            }

            if (profileResult?.error) {
              console.warn('[PRICING] Erreur profil:', profileResult.error)
              setIsPremium(false)
            } else {
              setIsPremium(profileResult?.data?.is_premium || false)
            }
          } catch (error: any) {
            console.warn('[PRICING] Erreur vérification premium:', error?.message || error)
            setIsPremium(false)
          }
        } else {
          setIsPremium(false)
        }
      } catch (error: any) {
        console.error('[PRICING] Erreur générale:', error?.message || error)
        if (isMounted) {
          setUser(null)
          setIsPremium(false)
        }
      } finally {
        stopChecking()
      }
    }

    // Démarrer la vérification dans un wrapper sécurisé
    Promise.resolve()
      .then(() => checkAuth())
      .catch((error) => {
        console.error('[PRICING] Erreur fatale lors de la vérification:', error)
        stopChecking()
        if (isMounted) {
          setUser(null)
          setIsPremium(false)
        }
      })

    // Écouter les changements d'authentification (seulement si Supabase fonctionne)
    try {
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!isMounted) return
        
        setUser(session?.user ?? null)

        if (session?.user) {
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('is_premium')
              .eq('id', session.user.id)
              .single()

            if (profileError) {
              console.warn('[PRICING] Erreur profil:', profileError)
              setIsPremium(false)
            } else {
              setIsPremium(profile?.is_premium || false)
            }
          } catch (error) {
            console.warn('[PRICING] Erreur premium:', error)
            setIsPremium(false)
          }
        } else {
          setIsPremium(false)
        }
      })
      
      subscription = authSubscription
    } catch (error) {
      console.warn('[PRICING] Impossible de s\'abonner aux changements:', error)
    }

    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
      if (subscription) subscription.unsubscribe()
    }
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
            <div className="text-white mb-4">Vérification...</div>
            <div className="text-gray-400 text-sm">
              Si cette page reste bloquée, essayez de rafraîchir la page.
            </div>
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

