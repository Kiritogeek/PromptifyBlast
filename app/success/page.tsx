'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SuccessPage() {
  const router = useRouter()
  const [isActivating, setIsActivating] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    // Récupérer le session_id depuis l'URL
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('session_id')
    setSessionId(sid)

    if (!sid) {
      console.error('Aucun session_id trouvé dans l\'URL')
      setIsActivating(false)
      return
    }

    // Vérifier directement le statut de paiement avec Stripe et activer le premium
    const checkPaymentAndActivate = async () => {
      try {

        // Appeler notre API pour vérifier le paiement et activer le premium
        const response = await fetch(`/api/check-payment?session_id=${sid}`)
        const data = await response.json()

        if (!response.ok) {
          console.error('Erreur API:', data.error)
          setIsActivating(false)
          return
        }

        if (data.paid && data.premium_activated) {
          
          // Invalider le cache premium pour forcer la mise à jour
          if (typeof window !== 'undefined') {
            localStorage.removeItem('premium_status')
            localStorage.removeItem('premium_user_id')
            localStorage.removeItem('premium_cache_time')
            // Mettre à jour le cache avec le nouveau statut premium
            localStorage.setItem('premium_status', 'true')
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
              localStorage.setItem('premium_user_id', session.user.id)
            }
            localStorage.setItem('premium_cache_time', Date.now().toString())
          }
          
          setIsActivating(false)
          // Forcer le rafraîchissement pour que /app détecte le changement
          router.refresh()
          // Rediriger vers /app après un court délai
          setTimeout(() => {
            router.push('/app')
          }, 1500)
        } else if (data.paid && !data.premium_activated) {
          // Paiement confirmé mais premium déjà activé (ou erreur)
          setIsActivating(false)
          router.refresh()
          setTimeout(() => {
            router.push('/app')
          }, 1500)
        } else {
          // Paiement non complété
          // Réessayer après 3 secondes
          setTimeout(checkPaymentAndActivate, 3000)
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du paiement:', error)
        // Réessayer après 3 secondes
        setTimeout(checkPaymentAndActivate, 3000)
      }
    }

    // Commencer la vérification après 1 seconde
    setTimeout(checkPaymentAndActivate, 1000)
  }, [router, sessionId])

  return (
    <main className="min-h-screen bg-gray-900 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-700">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Paiement réussi ! 🎉
              </h1>
              <p className="text-xl text-gray-300 mb-4">
                Bienvenue dans PromptifyBlast Premium
              </p>
            </div>

            <div className="bg-gray-700 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Vous avez maintenant accès à :
              </h2>
              <ul className="space-y-3 text-left">
                <li className="flex items-center text-gray-300">
                  <span className="text-green-500 mr-3">✓</span>
                  Générations illimitées
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="text-green-500 mr-3">✓</span>
                  Mode Pro débloqué
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="text-green-500 mr-3">✓</span>
                  Mode Ultra-Optimisé débloqué
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="text-green-500 mr-3">✓</span>
                  Requêtes prioritaires
                </li>
              </ul>
            </div>

            {isActivating ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-gray-300">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                  <span>Activation du Premium en cours...</span>
                </div>
                <p className="text-sm text-gray-400">
                  Veuillez patienter quelques secondes pendant que nous activons votre accès Premium.
                </p>
              </div>
            ) : (
              <Link
                href="/app"
                className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
              >
                Commencer à générer des prompts
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

