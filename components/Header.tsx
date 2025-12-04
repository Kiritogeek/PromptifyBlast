'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    // Vérifier si l'utilisateur est connecté
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        // Mettre à jour l'état seulement si on a une réponse valide
        setUser(session?.user ?? null)
      }).catch((error) => {
        console.warn('[HEADER] Erreur lors de la récupération de la session:', error)
        // ⚠️ Ne pas mettre setUser(null) ici - ne pas déconnecter l'utilisateur en cas d'erreur
        // L'utilisateur peut être connecté même si la récupération de session échoue temporairement
        // La session sera mise à jour via onAuthStateChange si nécessaire
      })

      // Écouter les changements d'authentification
      try {
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null)
        })
        subscription = authSubscription
      } catch (error) {
        console.warn('[HEADER] Impossible de s\'abonner aux changements d\'authentification:', error)
      }
    } catch (error) {
      console.warn('[HEADER] Erreur lors de l\'initialisation de Supabase:', error)
      setUser(null)
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const handleSignOut = async () => {
    try {
      // Nettoyer le localStorage avant la déconnexion
      if (typeof window !== 'undefined') {
        localStorage.removeItem('premium_status')
        localStorage.removeItem('premium_user_id')
        localStorage.removeItem('premium_cache_time')
      }

      // Essayer de se déconnecter via Supabase
      try {
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.error('[HEADER] Erreur lors de la déconnexion:', error)
          // Continuer quand même avec la redirection
        }
      } catch (supabaseError: any) {
        console.error('[HEADER] Erreur Supabase lors de la déconnexion:', supabaseError)
        // Si Supabase n'est pas disponible, continuer quand même
      }

      // Mettre à jour l'état local immédiatement
      setUser(null)

      // Utiliser window.location pour forcer un rechargement complet en production
      // Cela garantit que tous les cookies et états sont nettoyés
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (error: any) {
      console.error('[HEADER] Erreur lors de la déconnexion:', error)
      // En cas d'erreur, forcer quand même la redirection
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      } else {
        router.push('/')
        router.refresh()
      }
    }
  }

  return (
    <header className="border-b border-gray-800 bg-gray-900">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-white" aria-label="PromptifyBlast - Accueil">
            PromptifyBlast
          </Link>
          <nav className="flex items-center gap-6" aria-label="Navigation principale">
            <Link 
              href="/app" 
              className="text-gray-300 hover:text-white transition-colors"
              aria-label="Accéder au générateur de prompts"
            >
              Générateur
            </Link>
            <Link 
              href="/pricing" 
              className="text-gray-300 hover:text-white transition-colors"
              aria-label="Voir les tarifs Premium"
            >
              Premium
            </Link>
            <Link 
              href="/avis" 
              className="text-gray-300 hover:text-white transition-colors"
              aria-label="Voir les avis utilisateurs"
            >
              Avis
            </Link>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-gray-300 text-sm hidden md:block">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
              >
                Connexion
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

