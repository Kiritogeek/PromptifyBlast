'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Mode = 'pro' | 'basic' | 'ultra-optimized'
type TargetModel = 'chatgpt' | 'gemini' | 'gork' | null

export default function AppPage() {
  const [inputText, setInputText] = useState('')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [showOptimizedPrompt, setShowOptimizedPrompt] = useState(false)
  const [mode, setMode] = useState<Mode>('basic')
  const [targetModel, setTargetModel] = useState<TargetModel>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showLimitError, setShowLimitError] = useState(false)
  
  // Utiliser le cache localStorage pour éviter le flash de chargement
  // IMPORTANT: Ne pas initialiser depuis localStorage dans useState pour éviter les erreurs d'hydratation
  // On initialise toujours à false côté serveur et client, puis on met à jour après l'hydratation
  const [hasPremium, setHasPremium] = useState(false)
  const [genCount, setGenCount] = useState(0)
  const [remaining, setRemaining] = useState(3)
  const [isChecking, setIsChecking] = useState(true) // Commencer à true pour éviter l'hydratation mismatch
  const [user, setUser] = useState<any>(null)
  const lastCheckTimeRef = useRef<number>(0) // Utiliser une ref au lieu d'un state pour éviter les boucles infinies
  const hasInitializedRef = useRef(false) // Pour éviter les vérifications multiples
  const isMountedRef = useRef(true) // Pour suivre si le composant est monté

  // Vérifier le cache localStorage après l'hydratation (côté client uniquement)
  const getCachedPremium = (): boolean => {
    if (typeof window === 'undefined') return false
    const cached = localStorage.getItem('premium_status')
    const cachedUserId = localStorage.getItem('premium_user_id')
    const cachedTime = localStorage.getItem('premium_cache_time')
    
    // Vérifier si le cache est valide (moins de 5 minutes et même utilisateur)
    if (cached && cachedUserId && cachedTime) {
      const cacheAge = Date.now() - parseInt(cachedTime, 10)
      const maxAge = 5 * 60 * 1000 // 5 minutes
      if (cacheAge < maxAge) {
        return cached === 'true'
      }
    }
    return false
  }

  // Fonction de vérification du statut premium (accessible partout)
  const checkStatus = async (forceRefresh = false) => {
      if (!isMountedRef.current) return
      
      // Éviter les vérifications trop fréquentes (sauf si forcé)
      const now = Date.now()
      if (!forceRefresh && now - lastCheckTimeRef.current < 2000) {
        return // Ignorer si vérifié il y a moins de 2 secondes
      }
      
      lastCheckTimeRef.current = now

      setIsChecking(true)
      try {
        // Vérifier si l'utilisateur est connecté
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)

        if (session?.user) {
          // Utilisateur connecté : utiliser le profil dans la table profiles
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError)
          }

          if (profile) {
            // Vérifier explicitement unlimited_prompt (peut être true, false, 'true', 'false', 1, 0, ou null)
            // unlimited_prompt = TRUE signifie générations illimitées
            const rawUnlimited = profile.unlimited_prompt
            const hasUnlimited = rawUnlimited === true || rawUnlimited === 'true' || rawUnlimited === 1 || rawUnlimited === '1'
            setHasPremium(hasUnlimited)
            
            // Mettre en cache le statut premium (TOUJOURS depuis la BDD, pas depuis le cache)
            if (typeof window !== 'undefined') {
              localStorage.setItem('premium_status', hasUnlimited.toString())
              localStorage.setItem('premium_user_id', session.user.id)
              localStorage.setItem('premium_cache_time', Date.now().toString())
            }

            const today = new Date().toISOString().split('T')[0]
            
            // Pour les premium, on ne gère pas le compteur (illimité)
            if (hasUnlimited) {
              setGenCount(0)
              setRemaining(-1) // -1 = illimité
            } else {
              // Pour les non-premium, gérer le compteur quotidien
              if (profile.last_reset !== today) {
                // Réinitialiser dans la BDD
                const { error: resetError } = await supabase
                  .from('profiles')
                  .update({ 
                    daily_generations: 0, 
                    last_reset: today,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', session.user.id)
                
                setGenCount(0)
                setRemaining(3)
              } else {
                setGenCount(profile.daily_generations || 0)
                setRemaining(Math.max(0, 3 - (profile.daily_generations || 0)))
              }
            }
          } else {
            // Pas de profil encore, créer un profil par défaut
            const { data: newProfile } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                daily_generations: 0,
                last_reset: new Date().toISOString().split('T')[0],
                is_premium: false,
                unlimited_prompt: false, // Par défaut, générations limitées
              })
              .select()
              .single()

            if (newProfile) {
              setHasPremium(false)
              setGenCount(0)
              setRemaining(3)
              
              // Mettre en cache
              if (typeof window !== 'undefined') {
                localStorage.setItem('premium_status', 'false')
                localStorage.setItem('premium_user_id', session.user.id)
                localStorage.setItem('premium_cache_time', Date.now().toString())
              }
            }
          }
        } else {
          // Utilisateur non connecté : utiliser l'IP (table ip_usage)
          const response = await fetch('/api/ip/check')
          const data = await response.json()
          const dailyGen = data.daily_generations || 0
          // Utiliser unlimited_prompt si disponible, sinon is_premium pour compatibilité
          // Note: is_premium is legacy, use unlimited_prompt
          const hasUnlimited = data.unlimited_prompt === true || data.unlimited_prompt === 'true' || data.unlimited_prompt === 1 || data.is_premium === true
          setHasPremium(hasUnlimited)
          setGenCount(dailyGen)
          setRemaining(hasUnlimited ? -1 : Math.max(0, 3 - dailyGen))
          
          // Mettre en cache (sans user_id pour les utilisateurs non connectés)
          if (typeof window !== 'undefined') {
            localStorage.setItem('premium_status', hasUnlimited.toString())
            localStorage.removeItem('premium_user_id')
            localStorage.setItem('premium_cache_time', Date.now().toString())
          }
        }
      } catch (error) {
        console.error('Error checking status:', error)
        // En cas d'erreur, utiliser le cache comme fallback
        const cachedPremium = getCachedPremium()
        setHasPremium(cachedPremium)
        setGenCount(0)
        setRemaining(cachedPremium ? -1 : 3)
      } finally {
        setIsChecking(false)
      }
    }

  // Vérifier l'authentification et le statut premium (système intelligent avec cache)
  useEffect(() => {
    isMountedRef.current = true
    let checkTimeout: NodeJS.Timeout | null = null

    // Vérifier immédiatement (après l'hydratation)
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      
      // IMPORTANT: Toujours vérifier depuis la BDD en premier, pas depuis le cache
      // Le cache peut être obsolète si le statut a changé dans Supabase
      // On vérifie d'abord la BDD, puis on met à jour le cache
      checkStatus(true) // Force refresh = toujours vérifier depuis la BDD
    }

    // Écouter les changements d'authentification (seulement si l'utilisateur change)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMountedRef.current) return
      
      const currentUserId = session?.user?.id
      const cachedUserId = typeof window !== 'undefined' ? localStorage.getItem('premium_user_id') : null
      
      // Vérifier seulement si l'utilisateur a changé
      if (currentUserId !== cachedUserId) {
        checkStatus(true) // Forcer la vérification si l'utilisateur change
      }
    })

    // Rafraîchir le statut toutes les 30 secondes pour détecter les changements dans la BDD
    // IMPORTANT: Toujours vérifier depuis la BDD, pas depuis le cache
    const interval = setInterval(() => {
      if (!isMountedRef.current) return
      
      // Toujours vérifier depuis la BDD pour détecter les changements (ex: is_premium passé à FALSE)
      checkStatus(true) // Force refresh = toujours depuis la BDD
    }, 30000) // Toutes les 30 secondes

    return () => {
      isMountedRef.current = false
      subscription.unsubscribe()
      clearInterval(interval)
      if (checkTimeout) {
        clearTimeout(checkTimeout)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Pas de dépendances pour éviter les boucles infinies - on utilise des refs et des callbacks

  const handleModeChange = (newMode: Mode) => {
    if (!hasPremium && (newMode === 'pro' || newMode === 'ultra-optimized')) {
      alert('🔒 Mode Premium nécessaire ! Passez à Premium pour débloquer ce mode.')
      return
    }
    setMode(newMode)
  }

  const handleTargetModelChange = (newModel: TargetModel) => {
    if (!hasPremium && newModel !== null) {
      alert('🔒 Fonctionnalité Premium nécessaire ! Passez à Premium pour débloquer la sélection du modèle cible.')
      return
    }
    setTargetModel(newModel)
  }

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      alert('Veuillez entrer du texte')
      return
    }

    // Vérifier les limites pour les utilisateurs gratuits uniquement
    // Les premium ont remaining = -1 (illimité), donc cette vérification ne les bloque jamais
    if (!hasPremium && remaining <= 0) {
      setShowLimitError(true)
      setTimeout(() => setShowLimitError(false), 5000) // Afficher pendant 5 secondes
      return
    }

    // Pour les premium, on peut toujours générer (remaining = -1)
    if (hasPremium) {
    }

    // Réinitialiser l'état avant une nouvelle génération
    setIsLoading(true)
    setCopied(false)
    // Ne pas masquer showOptimizedPrompt ici - on le remplacera avec le nouveau résultat

    try {
      // Récupérer l'ID utilisateur pour l'envoyer dans les headers
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id || null
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId && { 'x-user-id': userId }), // Envoyer l'ID utilisateur dans les headers
        },
        body: JSON.stringify({ text: inputText, mode, targetModel }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || `Erreur HTTP: ${response.status}`
        
        // Si c'est une erreur de limite (429), afficher l'infobulle rouge
        // MAIS: Si l'utilisateur est premium, cette erreur ne devrait JAMAIS se produire
        if (response.status === 429 || errorMessage.includes('limite') || errorMessage.includes('Limite')) {
          if (hasPremium) {
            // Si l'utilisateur est premium mais reçoit une erreur de limite, c'est un bug
            console.error('ERREUR CRITIQUE: Utilisateur premium bloqué par limite')
            // Forcer le rafraîchissement du statut premium
            checkStatus(true)
          }
          setShowLimitError(true)
          setTimeout(() => setShowLimitError(false), 5000)
          setIsLoading(false)
          return
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (data.error) {
        alert(`Erreur: ${data.error}`)
        setIsLoading(false)
        return
      }
      
      if (!data.result) {
        alert('Aucun résultat reçu de l\'API')
        setIsLoading(false)
        return
      }
      
      // Remplacer l'ancien résultat par le nouveau (même si l'ancien n'a pas été copié)
      setGeneratedPrompt(data.result)
      setShowOptimizedPrompt(true)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)

      // Le compteur est maintenant géré côté serveur dans /api/generate
      // On rafraîchit juste l'affichage après une génération réussie
      // Pour les premium, pas besoin de rafraîchir le compteur (illimité)
      if (hasPremium) {
        // Utilisateur premium : toujours illimité
        setRemaining(-1) // -1 = illimité
        setGenCount(0) // Pas besoin de compter pour les premium
      } else {
        // Utilisateur non-premium : rafraîchir le compteur
        try {
          if (user) {
            // Utilisateur connecté : rafraîchir depuis profiles
            const today = new Date().toISOString().split('T')[0]
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single()

            if (profile) {
              let dailyGenerations = profile.daily_generations || 0
              if (profile.last_reset !== today) {
                dailyGenerations = 0
              }
              setGenCount(dailyGenerations)
              setRemaining(Math.max(0, 3 - dailyGenerations))
            }
          } else {
            // Utilisateur non connecté : rafraîchir depuis IP (table ip_usage)
            const statusResponse = await fetch('/api/ip/check')
            const statusData = await statusResponse.json()
            const dailyGen = statusData.daily_generations || 0
            setGenCount(dailyGen)
            setRemaining(Math.max(0, 3 - dailyGen))
          }
        } catch (error) {
          console.error('Error refreshing counter:', error)
        }
      }
    } catch (error: any) {
      console.error('Erreur lors de la génération:', error)
      alert(error.message || 'Une erreur est survenue lors de la génération')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!inputText) return

    try {
      await navigator.clipboard.writeText(inputText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Erreur lors de la copie:', error)
      alert('Impossible de copier le texte')
    }
  }

  const handleCopyOptimized = async () => {
    if (!generatedPrompt) return

    try {
      await navigator.clipboard.writeText(generatedPrompt)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        // Masquer la section après copie
        setShowOptimizedPrompt(false)
        setGeneratedPrompt('')
      }, 2000)
    } catch (error) {
      console.error('Erreur lors de la copie:', error)
      alert('Impossible de copier le texte')
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 py-12">
      {/* Notification de succès */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[320px] border border-green-400">
            <div className="flex-shrink-0 bg-white/20 rounded-full p-1.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-base">✓ Prompt généré avec succès !</p>
              <p className="text-sm text-green-50 mt-0.5">Votre prompt optimisé est prêt à être utilisé</p>
            </div>
          </div>
        </div>
      )}

      {/* Notification d'erreur - Limite atteinte */}
      {showLimitError && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[320px] border border-red-400">
            <div className="flex-shrink-0 bg-white/20 rounded-full p-1.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-base">🚫 Limite atteinte</p>
              <p className="text-sm text-red-50 mt-0.5">Vous avez utilisé vos 3 générations gratuites aujourd'hui. Passez à Premium pour des générations illimitées !</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Main Card */}
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 mb-8 border border-gray-700/50">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">
                Générateur de Prompts IA
              </h1>
              <p className="text-gray-300 mb-4 text-lg">
                Entrez votre idée et choisissez un mode pour générer un prompt optimisé
              </p>
              <h2 className="sr-only">Modes de génération disponibles</h2>
              <div className="bg-blue-900/20 backdrop-blur-sm border border-blue-700/50 rounded-xl p-4 mb-4 max-w-2xl mx-auto shadow-lg">
                <p className="text-sm text-blue-200 font-medium">
                  💡 Plus votre prompt initial est précis, plus la réponse sera précise également
                </p>
              </div>
            </div>

            {/* Text Input */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label 
                  htmlFor="input-text" 
                  className="block text-sm font-medium text-gray-300"
                >
                  Votre Prompt
                </label>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${
                    inputText.length > 1000 
                      ? 'text-red-400' 
                      : inputText.length > 800 
                        ? 'text-yellow-400' 
                        : 'text-gray-400'
                  }`}>
                    {inputText.length} / 1000
                  </span>
                </div>
              </div>
              <textarea
                id="input-text"
                value={inputText}
                onChange={(e) => {
                  if (e.target.value.length <= 1000) {
                    setInputText(e.target.value)
                  }
                }}
                maxLength={1000}
                placeholder="Tapez votre idée ici..."
                className={`w-full h-32 px-4 py-3 bg-gray-700/80 backdrop-blur-sm text-white border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-700 resize-none placeholder-gray-400 shadow-inner transition-all ${
                  inputText.length > 1000 
                    ? 'border-red-500/50' 
                    : inputText.length > 800 
                      ? 'border-yellow-500/50' 
                      : 'border-gray-600/50'
                }`}
              />
              {inputText.length > 1000 && (
                <p className="text-xs text-red-400 mt-1">
                  Limite de 1000 caractères atteinte
                </p>
              )}
            </div>

            {/* Prompt Optimisé */}
            {showOptimizedPrompt && generatedPrompt && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label 
                    htmlFor="optimized-prompt" 
                    className="block text-sm font-medium text-gray-300"
                  >
                    Prompt Optimisé
                  </label>
                  <button
                    onClick={handleCopyOptimized}
                    className="px-4 py-1.5 bg-blue-600/80 backdrop-blur-sm text-white rounded-xl hover:bg-blue-600 transition-all text-sm font-medium shadow-md border border-blue-500/30"
                  >
                    {copied ? '✓ Copié !' : 'Copier'}
                  </button>
                </div>
                <textarea
                  id="optimized-prompt"
                  value={generatedPrompt}
                  readOnly
                  className="w-full h-32 px-4 py-3 bg-gray-700/80 backdrop-blur-sm text-white border border-gray-600/50 rounded-xl resize-none placeholder-gray-400 shadow-inner cursor-default"
                />
              </div>
            )}

            {/* Mode Selector */}
            <section className="mb-6" aria-labelledby="mode-title">
              <h2 id="mode-title" className="block text-sm font-medium text-gray-300 mb-2">
                Mode de génération
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <button
                    onClick={() => handleModeChange('basic')}
                    className={`w-full px-6 py-3 rounded-xl border-2 transition-all shadow-md ${
                      mode === 'basic'
                        ? 'border-blue-500/80 bg-blue-900/60 backdrop-blur-sm text-blue-200 font-semibold shadow-blue-500/20'
                        : 'border-gray-600/50 bg-gray-700/80 backdrop-blur-sm text-gray-300 hover:border-gray-500/70 hover:bg-gray-700'
                    }`}
                  >
                    Mode Basique
                  </button>
                  {mode === 'basic' && (
                    <div className="mt-2 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg text-xs text-blue-200">
                      <p className="font-semibold mb-1">💡 Mode Basique</p>
                      <p>Optimisation classique simple : améliore la structure, la clarté et la lisibilité du prompt tout en conservant l'intention originale.</p>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => handleModeChange('pro')}
                    disabled={isChecking ? false : !hasPremium}
                    className={`w-full px-6 py-3 rounded-xl border-2 transition-all relative shadow-md ${
                      mode === 'pro'
                        ? 'border-blue-500/80 bg-blue-900/60 backdrop-blur-sm text-blue-200 font-semibold shadow-blue-500/20'
                        : (isChecking ? false : hasPremium)
                        ? 'border-gray-600/50 bg-gray-700/80 backdrop-blur-sm text-gray-300 hover:border-gray-500/70 hover:bg-gray-700'
                        : 'border-gray-700/50 bg-gray-800/60 backdrop-blur-sm text-gray-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    Mode Pro
                    {!isChecking && !hasPremium && (
                      <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                        🔒
                      </span>
                    )}
                  </button>
                  {mode === 'pro' && (
                    <div className="mt-2 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg text-xs text-blue-200">
                      <p className="font-semibold mb-1">💡 Mode Pro</p>
                      <p>Optimisation complète et détaillée : comprend profondément le besoin derrière le prompt, ajoute des contraintes détaillées, un rôle IA spécifique, et une analyse approfondie.</p>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => handleModeChange('ultra-optimized')}
                    disabled={isChecking ? false : !hasPremium}
                    className={`w-full px-6 py-3 rounded-xl border-2 transition-all relative shadow-md ${
                      mode === 'ultra-optimized'
                        ? 'border-blue-500/80 bg-blue-900/60 backdrop-blur-sm text-blue-200 font-semibold shadow-blue-500/20'
                        : (isChecking ? false : hasPremium)
                        ? 'border-gray-600/50 bg-gray-700/80 backdrop-blur-sm text-gray-300 hover:border-gray-500/70 hover:bg-gray-700'
                        : 'border-gray-700/50 bg-gray-800/60 backdrop-blur-sm text-gray-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    Mode Ultra-Optimisé
                    {!isChecking && !hasPremium && (
                      <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                        🔒
                      </span>
                    )}
                  </button>
                  {mode === 'ultra-optimized' && (
                    <div className="mt-2 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg text-xs text-blue-200">
                      <p className="font-semibold mb-1">💡 Mode Ultra-Optimisé</p>
                      <p>Optimisation maximale : prompt complet, extrêmement détaillé, avec contexte complet, toutes les contraintes, raisonnement avancé, et optimisé spécifiquement pour le modèle IA cible sélectionné.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Model Cible Selector */}
            <section className="mb-6" aria-labelledby="target-model-title">
              <h2 id="target-model-title" className="block text-sm font-medium text-gray-300 mb-2">
                Modèle Cible
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => handleTargetModelChange(targetModel === 'chatgpt' ? null : 'chatgpt')}
                  disabled={isChecking ? false : !hasPremium}
                  className={`w-full px-6 py-3 rounded-xl border-2 transition-all relative shadow-md ${
                    targetModel === 'chatgpt'
                      ? 'border-green-500/80 bg-green-900/60 backdrop-blur-sm text-green-200 font-semibold shadow-green-500/20'
                      : (isChecking ? false : hasPremium)
                      ? 'border-gray-600/50 bg-gray-700/80 backdrop-blur-sm text-gray-300 hover:border-gray-500/70 hover:bg-gray-700'
                      : 'border-gray-700/50 bg-gray-800/60 backdrop-blur-sm text-gray-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  ChatGPT
                  {!isChecking && !hasPremium && (
                    <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                      🔒
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTargetModelChange(targetModel === 'gemini' ? null : 'gemini')}
                  disabled={isChecking ? false : !hasPremium}
                  className={`w-full px-6 py-3 rounded-xl border-2 transition-all relative shadow-md ${
                    targetModel === 'gemini'
                      ? 'border-green-500/80 bg-green-900/60 backdrop-blur-sm text-green-200 font-semibold shadow-green-500/20'
                      : (isChecking ? false : hasPremium)
                      ? 'border-gray-600/50 bg-gray-700/80 backdrop-blur-sm text-gray-300 hover:border-gray-500/70 hover:bg-gray-700'
                      : 'border-gray-700/50 bg-gray-800/60 backdrop-blur-sm text-gray-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  Gemini
                  {!isChecking && !hasPremium && (
                    <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                      🔒
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTargetModelChange(targetModel === 'gork' ? null : 'gork')}
                  disabled={isChecking ? false : !hasPremium}
                  className={`w-full px-6 py-3 rounded-xl border-2 transition-all relative shadow-md ${
                    targetModel === 'gork'
                      ? 'border-green-500/80 bg-green-900/60 backdrop-blur-sm text-green-200 font-semibold shadow-green-500/20'
                      : (isChecking ? false : hasPremium)
                      ? 'border-gray-600/50 bg-gray-700/80 backdrop-blur-sm text-gray-300 hover:border-gray-500/70 hover:bg-gray-700'
                      : 'border-gray-700/50 bg-gray-800/60 backdrop-blur-sm text-gray-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  Grok
                  {!isChecking && !hasPremium && (
                    <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
                      🔒
                    </span>
                  )}
                </button>
              </div>
              {targetModel && (
                <div className="mt-2 p-3 bg-green-900/30 border border-green-700/50 rounded-lg text-xs text-green-200">
                  <p className="font-semibold mb-1">🎯 Modèle Cible : {targetModel === 'chatgpt' ? 'ChatGPT' : targetModel === 'gemini' ? 'Gemini' : 'Grok'}</p>
                  <p>
                    {targetModel === 'chatgpt' && 'Le prompt sera optimisé spécifiquement pour ChatGPT (GPT-4/GPT-3.5) avec des instructions claires, un format structuré, et en exploitant les forces de ChatGPT dans le suivi d\'instructions détaillées.'}
                    {targetModel === 'gemini' && 'Le prompt sera optimisé spécifiquement pour Google Gemini avec un langage clair et direct, en exploitant les capacités multimodales de Gemini si pertinent, et structuré pour son style de raisonnement.'}
                    {targetModel === 'gork' && 'Le prompt sera optimisé spécifiquement pour Grok (xAI) avec un format conversationnel mais structuré, en exploitant les connaissances en temps réel de Grok et son style de communication direct.'}
                  </p>
                </div>
              )}
            </section>

            {/* Compteur de générations pour utilisateurs gratuits */}
            {!hasPremium && !isChecking && (
              <div className={`mb-6 p-5 rounded-xl border backdrop-blur-sm shadow-lg ${
                remaining === 0 
                  ? 'bg-red-900/20 border-red-600/50' 
                  : 'bg-gray-700/80 border-gray-600/50'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm mb-1 ${
                      remaining === 0 
                        ? 'text-red-300' 
                        : 'text-gray-300'
                    }`}>
                      Générations gratuites aujourd'hui
                    </p>
                    <p className={`text-2xl font-bold ${
                      remaining === 0 
                        ? 'text-red-400' 
                        : 'text-white'
                    }`}>
                      {remaining} / 3
                    </p>
                    <p className={`text-xs mt-1 ${
                      remaining === 0 
                        ? 'text-red-300' 
                        : 'text-gray-400'
                    }`}>
                      {genCount} génération{genCount > 1 ? 's' : ''} utilisée{genCount > 1 ? 's' : ''} sur 3
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href="/pricing"
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all text-sm font-semibold shadow-md hover:shadow-lg"
                    >
                      Passer au Premium
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Message pour utilisateurs premium */}
            {hasPremium && !isChecking && (
              <div className="mb-6 p-5 bg-green-900/20 backdrop-blur-sm rounded-xl border border-green-600/50 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-300 mb-1 font-semibold">
                      ✓ Premium Actif
                    </p>
                    <p className="text-2xl font-bold text-green-400">
                      Générations illimitées
                    </p>
                    <p className="text-xs text-green-300 mt-1">
                      Vous pouvez générer autant de prompts que vous le souhaitez
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !inputText.trim()}
              className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Génération en cours...' : 'Générer le prompt'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

