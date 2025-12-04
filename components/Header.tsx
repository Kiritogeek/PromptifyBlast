'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
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
          // Mettre à jour l'utilisateur quand la session change
          // Cela détecte automatiquement les déconnexions
          setUser(session?.user ?? null)
          
          // Si déconnexion détectée, nettoyer le localStorage
          if (!session?.user && typeof window !== 'undefined') {
            localStorage.removeItem('premium_status')
            localStorage.removeItem('premium_user_id')
            localStorage.removeItem('premium_cache_time')
          }
        })
        subscription = authSubscription
      } catch (error) {
        console.warn('[HEADER] Impossible de s\'abonner aux changements d\'authentification:', error)
      }
      
      // Vérifier la session périodiquement pour détecter les déconnexions
      // Utile après une redirection depuis Stripe où les cookies peuvent être corrompus
      let checkSessionInterval: NodeJS.Timeout | null = null
      
      // Utiliser une fonction pour vérifier avec la valeur actuelle de user
      const checkSession = () => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          // Utiliser setUser avec une fonction pour avoir la valeur actuelle
          setUser((currentUser: any) => {
            if (!session?.user && currentUser) {
              // Session perdue, mettre à jour l'état
              console.log('[HEADER] Session perdue détectée, déconnexion')
              if (typeof window !== 'undefined') {
                localStorage.removeItem('premium_status')
                localStorage.removeItem('premium_user_id')
                localStorage.removeItem('premium_cache_time')
              }
              return null
            }
            return session?.user ?? null
          })
        }).catch(() => {
          // Ignorer les erreurs de vérification
        })
      }
      
      // Vérifier immédiatement puis toutes les 5 secondes
      checkSessionInterval = setInterval(checkSession, 5000)
      
      return () => {
        if (subscription) {
          subscription.unsubscribe()
        }
        if (checkSessionInterval) {
          clearInterval(checkSessionInterval)
        }
      }
    } catch (error) {
      console.warn('[HEADER] Erreur lors de l\'initialisation de Supabase:', error)
      setUser(null)
    }
  }, [])

  const handleSignOut = async () => {
    try {
      // Nettoyer le localStorage AVANT la déconnexion
      if (typeof window !== 'undefined') {
        localStorage.clear() // Nettoyer TOUT le localStorage pour être sûr
      }

      // Mettre à jour l'état local immédiatement pour un feedback visuel instantané
      setUser(null)

      // Essayer de se déconnecter via Supabase avec timeout
      // Après une redirection depuis Stripe, les cookies peuvent être corrompus
      try {
        const signOutPromise = supabase.auth.signOut({
          scope: 'global' // Déconnexion globale pour tous les onglets
        })
        
        // Timeout de 1.5 secondes pour éviter d'attendre indéfiniment
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 1500)
        )
        
        await Promise.race([signOutPromise, timeoutPromise])
        
        console.log('[HEADER] Déconnexion Supabase réussie')
      } catch (supabaseError: any) {
        // Si Supabase échoue (timeout, erreur cookies, etc.), continuer quand même
        console.warn('[HEADER] Erreur Supabase lors de la déconnexion:', supabaseError?.message || supabaseError)
      }

      // Nettoyer TOUS les cookies Supabase possibles (même si signOut() a réussi)
      if (typeof document !== 'undefined') {
        const hostname = window.location.hostname
        const domainParts = hostname.split('.')
        
        // Liste de tous les cookies Supabase possibles
        const cookiesToRemove = [
          'sb-access-token',
          'sb-refresh-token',
          'supabase.auth.token',
          `sb-${hostname}-auth-token`,
          `sb-${hostname.replace(/\./g, '-')}-auth-token`
        ]
        
        // Supprimer pour le domaine actuel et tous les sous-domaines possibles
        cookiesToRemove.forEach(cookieName => {
          // Supprimer pour le chemin racine
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
          
          // Supprimer pour le domaine actuel
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${hostname};`
          
          // Supprimer pour le domaine parent (ex: .vercel.app)
          if (domainParts.length > 1) {
            const parentDomain = '.' + domainParts.slice(-2).join('.')
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${parentDomain};`
          }
        })
        
        // Nettoyer tous les cookies qui commencent par 'sb-'
        const allCookies = document.cookie.split(';')
        allCookies.forEach(cookie => {
          const cookieName = cookie.split('=')[0].trim()
          if (cookieName.startsWith('sb-') || cookieName.includes('supabase')) {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${hostname};`
            if (domainParts.length > 1) {
              const parentDomain = '.' + domainParts.slice(-2).join('.')
              document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${parentDomain};`
            }
          }
        })
      }

      // Utiliser window.location.href pour forcer un rechargement complet
      // Cela garantit que tous les cookies et états sont nettoyés
      // IMPORTANT : Utiliser window.location même si Supabase échoue
      if (typeof window !== 'undefined') {
        // Redirection immédiate pour éviter que Supabase ne restaure la session
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
          <Link href="/" className="text-xl sm:text-2xl font-bold text-white" aria-label="PromptifyBlast - Accueil">
            PromptifyBlast
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-6" aria-label="Navigation principale">
            <Link 
              href="/app" 
              className="text-gray-300 hover:text-white transition-colors text-sm lg:text-base"
              aria-label="Accéder au générateur de prompts"
            >
              Générateur
            </Link>
            <Link 
              href="/pricing" 
              className="text-gray-300 hover:text-white transition-colors text-sm lg:text-base"
              aria-label="Voir les tarifs Premium"
            >
              Premium
            </Link>
            <Link 
              href="/avis" 
              className="text-gray-300 hover:text-white transition-colors text-sm lg:text-base"
              aria-label="Voir les avis utilisateurs"
            >
              Avis
            </Link>
            {user ? (
              <div className="flex items-center gap-3 lg:gap-4">
                <span className="text-gray-300 text-xs lg:text-sm hidden lg:block max-w-[150px] truncate">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 lg:px-4 lg:py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors text-xs lg:text-sm"
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 lg:px-4 lg:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs lg:text-sm font-semibold"
              >
                Connexion
              </Link>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-gray-300 hover:text-white transition-colors p-2"
            aria-label="Menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 border-t border-gray-800 pt-4" aria-label="Navigation mobile">
            <div className="flex flex-col gap-4">
              <Link 
                href="/app" 
                onClick={() => setIsMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors py-2"
                aria-label="Accéder au générateur de prompts"
              >
                Générateur
              </Link>
              <Link 
                href="/pricing" 
                onClick={() => setIsMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors py-2"
                aria-label="Voir les tarifs Premium"
              >
                Premium
              </Link>
              <Link 
                href="/avis" 
                onClick={() => setIsMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors py-2"
                aria-label="Voir les avis utilisateurs"
              >
                Avis
              </Link>
              {user ? (
                <div className="flex flex-col gap-3 pt-2 border-t border-gray-800">
                  <span className="text-gray-300 text-sm truncate">
                    {user.email}
                  </span>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false)
                      handleSignOut()
                    }}
                    className="w-full px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors text-sm text-left"
                  >
                    Déconnexion
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold text-center"
                >
                  Connexion
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}

