'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Liste des domaines email les plus utilisés (pour éviter les fautes de frappe)
  const validDomains = [
    'gmail.com',
    'outlook.com',
    'outlook.fr',
    'yahoo.com',
    'yahoo.fr',
    'hotmail.com',
    'hotmail.fr',
    'icloud.com',
    'protonmail.com',
    'live.com'
  ]

  // Fonction pour valider le format de l'email avec un domaine valide
  const validateEmail = (email: string): boolean => {
    // Expression régulière pour vérifier le format de base de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    if (!emailRegex.test(email)) {
      return false
    }
    
    // Extraire le domaine (partie après @)
    const domain = email.split('@')[1]?.toLowerCase()
    
    if (!domain) {
      return false
    }
    
    // Vérifier que le domaine correspond exactement à un domaine de la liste blanche
    // Cela évite les fautes de frappe comme @gmai.com au lieu de @gmail.com
    if (!validDomains.includes(domain)) {
      return false
    }
    
    return true
  }

  // Fonction pour traduire les messages d'erreur Supabase en français
  const translateError = (errorMessage: string, errorCode?: string): string => {
    const errorLower = errorMessage.toLowerCase()
    const codeLower = errorCode?.toLowerCase() || ''
    
    // Vérifier d'abord le code d'erreur (plus fiable)
    if (codeLower === 'email_not_confirmed' || errorLower.includes('email not confirmed') || errorLower.includes('email_not_confirmed')) {
      return 'Email non confirmé. Veuillez désactiver la confirmation d\'email dans Supabase Settings → Authentication, ou vérifiez votre boîte mail pour confirmer votre compte.'
    }
    if (codeLower === 'invalid_credentials' || codeLower.includes('invalid_credentials') || errorLower.includes('invalid login credentials') || errorLower.includes('invalid_credentials') || errorLower.includes('invalid credentials')) {
      return 'Identifiants invalides. Vérifiez que votre email et votre mot de passe sont corrects.\n\n💡 Si vous venez de créer un compte :\n- Assurez-vous que la confirmation d\'email est désactivée dans Supabase\n- Vérifiez que vous utilisez le bon email et mot de passe\n- Si le problème persiste, essayez de créer un nouveau compte'
    }
    if (codeLower === 'user_already_registered' || errorLower.includes('user already registered') || errorLower.includes('user_already_registered')) {
      return 'Cet email est déjà enregistré. Connectez-vous ou utilisez un autre email.'
    }
    if (errorLower.includes('password') && errorLower.includes('weak')) {
      return 'Mot de passe trop faible. Le mot de passe doit contenir au moins 6 caractères.'
    }
    if (errorLower.includes('password')) {
      return 'Erreur de mot de passe. Vérifiez que votre mot de passe est correct.'
    }
    if (errorLower.includes('email') && errorLower.includes('invalid')) {
      return 'Adresse email invalide. Vérifiez que l\'email est correctement formaté.'
    }
    if (errorLower.includes('email')) {
      return 'Erreur d\'email. Vérifiez que l\'adresse email est valide.'
    }
    
    // Retourner le message d'erreur original si aucune traduction n'est trouvée
    return errorMessage || 'Une erreur est survenue lors de l\'authentification.'
  }

  useEffect(() => {
    // Afficher un message si redirection depuis pricing
    const message = searchParams.get('message')
    const redirect = searchParams.get('redirect')
    if (message) {
      setError(message)
    }
  }, [searchParams])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Vérifier le format de l'email uniquement lors de l'inscription
    if (isSignUp && !validateEmail(email)) {
      setError('Domaine email invalide. Utilisez un domaine valide : @gmail.com, @outlook.com, @outlook.fr, @yahoo.com, @yahoo.fr, @hotmail.com, @hotmail.fr, @icloud.com, @protonmail.com, @live.com')
      setLoading(false)
      return
    }

    // Vérifier que les mots de passe correspondent lors de l'inscription
    if (isSignUp && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      setLoading(false)
      return
    }

    try {
      if (isSignUp) {
        // Inscription sans email de confirmation (tout est géré en BDD)
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
          },
        })
        if (error) {
          // Extraire le code d'erreur si disponible
          const errorCode = (error as any).code || (error as any).status || error.message
          throw { message: error.message, code: errorCode }
        }
        
        // Si l'utilisateur est automatiquement connecté (confirmation d'email désactivée dans Supabase)
        if (data.user && data.session) {
          setSuccessMessage('Inscription réussie !')
          setShowSuccess(true)
          setTimeout(() => {
            setShowSuccess(false)
            const redirect = searchParams.get('redirect') || '/app'
            router.push(redirect)
            router.refresh()
          }, 1500)
        } else if (data.user) {
          // Si la session n'est pas créée automatiquement, essayer de se connecter immédiatement
          // (peut arriver si la confirmation d'email est encore activée dans Supabase)
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          
          if (!signInError && signInData.session) {
            // Connexion réussie
            setSuccessMessage('Inscription réussie !')
            setShowSuccess(true)
            setTimeout(() => {
              setShowSuccess(false)
              const redirect = searchParams.get('redirect') || '/app'
              router.push(redirect)
              router.refresh()
            }, 1500)
          } else {
            // Si la connexion échoue (email non confirmé), afficher un message
            throw new Error('Inscription réussie. Veuillez désactiver la confirmation d\'email dans Supabase pour une connexion automatique, ou vérifiez votre email pour confirmer votre compte.')
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        
        if (error) {
          // Extraire le code d'erreur depuis l'objet error de Supabase
          const errorCode = (error as any).code || (error as any).status || null
          throw { 
            message: error.message, 
            code: errorCode,
            originalError: error
          }
        }
        
        // Afficher l'infobulle de succès
        setSuccessMessage('Connexion réussie !')
        setShowSuccess(true)
        
        // Rediriger vers la page demandée ou /app par défaut après un court délai
        setTimeout(() => {
          setShowSuccess(false)
          const redirect = searchParams.get('redirect') || '/app'
          router.push(redirect)
          router.refresh()
        }, 1500)
      }
    } catch (error: any) {
      // Récupérer le code d'erreur si disponible
      const errorCode = error?.code || error?.status || error?.error_code
      const errorMessage = error?.message || error?.error_description || 'Erreur inconnue'
      setError(translateError(errorMessage, errorCode))
      console.error('Erreur d\'authentification:', { message: errorMessage, code: errorCode, fullError: error })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 py-12">
      {/* Notification de succès - Connexion et Inscription */}
      {showSuccess && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 animate-slide-in">
          <div className="bg-gradient-to-r from-green-600 to-green-500 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-2xl flex items-center gap-3 w-full sm:w-auto sm:min-w-[320px] border border-green-400">
            <div className="flex-shrink-0 bg-white/20 rounded-full p-1.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-base">✅ {successMessage}</p>
              <p className="text-sm text-green-50 mt-0.5">
                {isSignUp ? 'Redirection en cours...' : 'Redirection en cours...'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-md mx-auto">
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8 border border-gray-700">
            <div className="text-center mb-6 sm:mb-8">
              <Link href="/" className="text-2xl sm:text-3xl font-bold text-white mb-2 block">
                PromptifyBlast
              </Link>
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {isSignUp ? 'Créer un compte' : 'Se connecter'}
              </h1>
              <p className="text-sm sm:text-base text-gray-400">
                {isSignUp 
                  ? 'Rejoignez PromptifyBlast pour générer des prompts optimisés'
                  : 'Accédez à votre compte'
                }
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/50 border border-red-600 rounded-lg">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="exemple@gmail.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {isSignUp && (
                  <p className="text-xs text-gray-400 mt-1">
                    Minimum 6 caractères
                  </p>
                )}
              </div>
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirmation de mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-3 pr-12 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                      aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">
                      Les mots de passe ne correspondent pas
                    </p>
                  )}
                  {password && confirmPassword && password === confirmPassword && (
                    <p className="text-xs text-green-400 mt-1">
                      ✓ Les mots de passe correspondent
                    </p>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {loading ? 'Chargement...' : isSignUp ? 'S\'inscrire' : 'Se connecter'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                  setConfirmPassword('') // Réinitialiser la confirmation lors du changement de mode
                }}
                className="text-sm text-gray-400 hover:text-gray-300"
              >
                {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-xs text-gray-400 text-center">
                En vous connectant, vous acceptez nos conditions d'utilisation
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-300 text-sm"
            >
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-white">Chargement...</div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  )
}

