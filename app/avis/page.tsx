'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'louisbasnier@gmail.com'

export default function AvisPage() {
  const [avis, setAvis] = useState('')
  const [tag, setTag] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewMode, setViewMode] = useState<'form' | 'admin'>('form')
  const [allAvis, setAllAvis] = useState<any[]>([])
  const [isLoadingAvis, setIsLoadingAvis] = useState(false)
  const [userTag, setUserTag] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeletingAll, setIsDeletingAll] = useState(false)

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté et s'il est admin
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (currentUser) {
        // Récupérer le profil pour vérifier is_admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', currentUser.id)
          .maybeSingle()

        const isUserAdmin = profile?.is_admin === true || profile?.is_admin === 'true' || profile?.is_admin === 1
        setIsAdmin(isUserAdmin)
      } else {
        setIsAdmin(false)
      }
    }

    checkUser()

    // Écouter les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (currentUser) {
        // Récupérer le profil pour vérifier is_admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', currentUser.id)
          .maybeSingle()

        const isUserAdmin = profile?.is_admin === true || profile?.is_admin === 'true' || profile?.is_admin === 1
        setIsAdmin(isUserAdmin)
        
        if (!isUserAdmin) {
          setViewMode('form')
        }
      } else {
        setIsAdmin(false)
        setViewMode('form')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // Charger le tag de l'utilisateur s'il est connecté
    if (user) {
      loadUserTag()
    } else {
      setUserTag(null)
      setTag('')
    }
  }, [user])

  const loadUserTag = async () => {
    if (!user) return

    try {
      // Utiliser l'API pour récupérer le tag (via GET /api/avis qui retourne aussi le tag de l'utilisateur)
      // Pour l'instant, on va juste réinitialiser le tag à vide
      // Le tag sera chargé après la soumission
      setUserTag(null)
      setTag('')
    } catch (error) {
      setUserTag(null)
      setTag('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!avis.trim()) {
      alert('Veuillez entrer un avis')
      return
    }

    if (avis.length > 250) {
      alert('L\'avis ne peut pas dépasser 250 caractères')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/avis/submit', {
        method: 'POST',
        credentials: 'include', // Inclure les cookies
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: avis.trim(),
          tag: tag.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi de l\'avis')
      }

      setShowSuccess(true)
      setAvis('')
      setTag('')
      setUserTag(tag.trim() || null)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error: any) {
      console.error('Error submitting avis:', error)
      alert(`Erreur lors de l'envoi de l'avis: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTag = async () => {
    if (!user) {
      setTag('')
      setUserTag(null)
      return
    }

    try {
      // Supprimer le tag en envoyant un avis avec tag null
      const response = await fetch('/api/avis/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: avis.trim() || ' ', // Garder le contenu existant ou un espace
          tag: null,
        }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression du tag')
      }

      setTag('')
      setUserTag(null)
    } catch (error: any) {
      console.error('Error deleting tag:', error)
      alert(`Erreur lors de la suppression du tag: ${error.message}`)
    }
  }

  const loadAllAvis = async () => {
    setIsLoadingAvis(true)
    try {
      console.log('Chargement des avis...')
      
      // Récupérer l'ID utilisateur pour l'envoyer dans les headers
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id || null
      
      // Créer un AbortController pour gérer le timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // Timeout de 30 secondes
      
      try {
        const response = await fetch('/api/avis', {
          method: 'GET',
          credentials: 'include', // Inclure les cookies
          headers: {
            'Content-Type': 'application/json',
            ...(userId && { 'x-user-id': userId }), // Envoyer l'ID utilisateur dans les headers
          },
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
      
        console.log('Response status:', response.status)
        
        if (!response.ok) {
          const errorData = await response.json()
          console.error('Error response:', errorData)
          
          // Si l'utilisateur n'est pas admin (403) ou non authentifié (401), ne pas afficher d'erreur
          // car cela signifie simplement qu'il n'a pas les droits
          if (response.status === 403 || response.status === 401) {
            console.log(`Accès refusé (${response.status}) - Admin uniquement`)
            setAllAvis([])
            // Si l'utilisateur n'est pas admin, revenir au mode formulaire
            if (!isAdmin) {
              setViewMode('form')
            }
            return
          }
          
          throw new Error(errorData.error || 'Erreur lors de la récupération des avis')
        }

        const data = await response.json()
        console.log('Réponse complète de l\'API:', data)
        console.log('Avis reçus:', data.avis)
        console.log('Type de data.avis:', typeof data.avis, Array.isArray(data.avis))
        console.log('Nombre d\'avis:', data.avis?.length || 0)
        
        if (data.avis && Array.isArray(data.avis)) {
          console.log('Affectation de', data.avis.length, 'avis')
          // Log détaillé de chaque avis pour déboguer
          data.avis.forEach((avis: any, index: number) => {
            console.log(`Avis ${index + 1}:`, {
              id: avis.id,
              user_id: avis.user_id,
              user_email: avis.user_email,
              hasEmail: !!avis.user_email,
              content: avis.content?.substring(0, 50) + '...'
            })
          })
          setAllAvis(data.avis)
        } else {
          console.warn('Format de données inattendu. data.avis:', data.avis)
          setAllAvis([])
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          console.error('Timeout lors du chargement des avis')
          alert('Le chargement des avis a pris trop de temps. Veuillez réessayer.')
          setAllAvis([])
          return
        }
        throw fetchError
      }
    } catch (error: any) {
      console.error('Error loading avis:', error)
      // Ne pas afficher d'alerte si l'utilisateur n'est simplement pas admin
      if (!error.message?.includes('Non authentifié') && !error.message?.includes('Accès refusé')) {
        alert(`Erreur lors du chargement des avis: ${error.message || 'Erreur inconnue'}`)
      }
      setAllAvis([])
    } finally {
      setIsLoadingAvis(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'admin' && isAdmin) {
      console.log('Mode admin activé, chargement des avis...')
      loadAllAvis()
    } else {
      console.log('Mode admin non activé:', { viewMode, isAdmin })
    }
  }, [viewMode, isAdmin])

  const handleDeleteAvis = async (avisId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet avis ?')) {
      return
    }

    setDeletingId(avisId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id || null

      const response = await fetch(`/api/avis/delete?id=${avisId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(userId && { 'x-user-id': userId }),
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la suppression')
      }

      // Recharger la liste des avis
      await loadAllAvis()
    } catch (error: any) {
      console.error('Error deleting avis:', error)
      alert(`Erreur lors de la suppression: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteAllAvis = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer TOUS les avis ? Cette action est irréversible.')) {
      return
    }

    setIsDeletingAll(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id || null

      const response = await fetch('/api/avis/delete?all=true', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(userId && { 'x-user-id': userId }),
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la suppression')
      }

      // Recharger la liste des avis (qui sera vide maintenant)
      await loadAllAvis()
      alert('Tous les avis ont été supprimés avec succès')
    } catch (error: any) {
      console.error('Error deleting all avis:', error)
      alert(`Erreur lors de la suppression: ${error.message}`)
    } finally {
      setIsDeletingAll(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Aidez-nous à améliorer PromptifyBlast !
            </h1>
            <h2 className="sr-only">Formulaire d'avis</h2>
            <p className="text-gray-300 text-lg">
              Votre avis est précieux pour nous permettre d'améliorer continuellement notre service.
            </p>
          </div>

          {/* Admin Switch */}
          {isAdmin && (
            <div className="mb-6 flex justify-center">
              <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-1 border border-gray-700/50 inline-flex">
                <button
                  onClick={() => setViewMode('form')}
                  className={`px-6 py-2 rounded-lg transition-all ${
                    viewMode === 'form'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Formulaire
                </button>
                <button
                  onClick={() => setViewMode('admin')}
                  className={`px-6 py-2 rounded-lg transition-all ${
                    viewMode === 'admin'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Avis Utilisateurs
                </button>
              </div>
            </div>
          )}

          {/* Success Notification */}
          {showSuccess && (
            <div className="fixed top-4 right-4 z-50 animate-slide-in">
              <div className="bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[320px] border border-green-400">
                <div className="flex-shrink-0 bg-white/20 rounded-full p-1.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-base">✓ Avis envoyé avec succès !</p>
                  <p className="text-sm text-green-50 mt-0.5">Merci pour votre contribution</p>
                </div>
              </div>
            </div>
          )}

          {/* Form View */}
          {viewMode === 'form' && (
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700/50">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Avis Textarea */}
                <div>
                  <label htmlFor="avis" className="block text-sm font-medium text-gray-300 mb-2">
                    Votre avis
                  </label>
                  <textarea
                    id="avis"
                    value={avis}
                    onChange={(e) => {
                      if (e.target.value.length <= 250) {
                        setAvis(e.target.value)
                      }
                    }}
                    maxLength={250}
                    rows={6}
                    placeholder="Partagez votre avis, vos suggestions ou vos retours..."
                    className="w-full px-4 py-3 bg-gray-700/80 backdrop-blur-sm text-white border border-gray-600/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-700 resize-none placeholder-gray-400 shadow-inner transition-all"
                    required
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-400">
                      {avis.length} / 250 caractères
                    </p>
                    {avis.length === 250 && (
                      <p className="text-xs text-yellow-400">
                        Limite atteinte
                      </p>
                    )}
                  </div>
                </div>

                {/* Tag Input */}
                <div>
                  <label htmlFor="tag" className="block text-sm font-medium text-gray-300 mb-2">
                    Tag (optionnel, 1 maximum, max 15 caractères)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="tag"
                      type="text"
                      value={tag}
                      onChange={(e) => {
                        if (e.target.value.length <= 15) {
                          setTag(e.target.value)
                        }
                      }}
                      maxLength={15}
                      placeholder="Ex: Bug, Suggestion..."
                      className="flex-1 px-4 py-3 bg-gray-700/80 backdrop-blur-sm text-white border border-gray-600/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-700 placeholder-gray-400 shadow-inner transition-all"
                    />
                    {userTag && (
                      <button
                        type="button"
                        onClick={handleDeleteTag}
                        className="px-4 py-3 bg-red-600/80 text-white rounded-xl hover:bg-red-600 transition-all text-sm font-medium"
                      >
                        Supprimer le tag
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-400">
                      {userTag ? 'Vous avez déjà un tag. Supprimez-le pour en créer un nouveau.' : 'Vous pouvez ajouter un tag pour catégoriser votre avis.'}
                    </p>
                    <p className={`text-xs font-medium ${
                      tag.length > 12 
                        ? 'text-red-400' 
                        : tag.length > 10 
                          ? 'text-yellow-400' 
                          : 'text-gray-400'
                    }`}>
                      {tag.length} / 15
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !avis.trim()}
                  className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Envoi en cours...' : 'Envoyer mon avis'}
                </button>
              </form>
            </div>
          )}

          {/* Admin View */}
          {viewMode === 'admin' && isAdmin && (
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700/50">
              <div className="mb-6 flex items-center justify-between">
                <div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Avis Utilisateurs
                </h1>
                  <p className="text-gray-400 text-sm">
                    Liste de tous les avis envoyés par les utilisateurs
                  </p>
                </div>
                {allAvis.length > 0 && (
                  <button
                    onClick={handleDeleteAllAvis}
                    disabled={isDeletingAll}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {isDeletingAll ? 'Suppression...' : 'Supprimer tout'}
                  </button>
                )}
              </div>

              {isLoadingAvis ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">Chargement des avis...</p>
                </div>
              ) : allAvis.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 mb-2">Aucun avis pour le moment</p>
                  <p className="text-gray-500 text-xs">
                    Les avis envoyés par les utilisateurs apparaîtront ici
                  </p>
                  <p className="text-gray-600 text-xs mt-2">
                    (Vérifiez la console pour les détails de débogage)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allAvis.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-700/50 rounded-xl p-6 border border-gray-600/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {item.isPremium && (
                                <span className="px-2 py-1 bg-yellow-600/80 text-yellow-100 text-xs rounded-full font-semibold">
                                  Premium
                                </span>
                              )}
                              {item.tag && (
                                <span className="px-2 py-1 bg-blue-600/80 text-blue-100 text-xs rounded-full">
                                  {item.tag}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteAvis(item.id)}
                              disabled={deletingId === item.id}
                              className="px-3 py-1.5 bg-red-600/80 text-white rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-xs font-medium"
                            >
                              {deletingId === item.id ? 'Suppression...' : 'Supprimer'}
                            </button>
                          </div>
                          <p className="text-gray-300 text-sm mb-2">
                            {item.content}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(item.created_at).toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
