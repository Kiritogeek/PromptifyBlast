'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Écouter les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
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

