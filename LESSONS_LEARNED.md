# Guide Complet : Création d'Applications avec Supabase, Stripe et Groq API

## 📋 Table des Matières
1. [Configuration Supabase](#configuration-supabase)
2. [Configuration Stripe](#configuration-stripe)
3. [Configuration Groq API](#configuration-groq-api)
4. [Bugs Critiques et Solutions](#bugs-critiques-et-solutions)
5. [Bonnes Pratiques](#bonnes-pratiques)
6. [Patterns qui Fonctionnent](#patterns-qui-fonctionnent)

---

## 🔵 Configuration Supabase

### Variables d'Environnement Requises

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (clé publique anon)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (clé secrète service_role)
```

**⚠️ IMPORTANT** :
- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont accessibles côté client (préfixe `NEXT_PUBLIC_`)
- `SUPABASE_SERVICE_ROLE_KEY` est SECRET et ne doit JAMAIS être exposé côté client
- Toutes ces variables doivent être définies dans Vercel pour chaque environnement (Production, Preview, Development)

### Initialisation du Client Supabase

#### Client Côté Client (Browser)
```typescript
// lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Retourner un Proxy qui lance une erreur lors de l'utilisation
    // Cela permet au build de réussir même si les variables ne sont pas définies
    return new Proxy({} as SupabaseClient, {
      get(_target, prop) {
        if (prop === 'auth') {
          return new Proxy({}, {
            get() {
              throw new Error('Supabase non configuré. Configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans Vercel.')
            }
          })
        }
        throw new Error('Supabase non configuré.')
      }
    }) as SupabaseClient
  }
  
  _supabase = createClient(supabaseUrl, supabaseAnonKey)
  return _supabase
}

// Export avec Proxy pour initialisation lazy
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
}) as SupabaseClient
```

#### Client Côté Serveur (API Routes)
```typescript
// lib/supabase-server.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

let _supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[SUPABASE_ADMIN] Variables manquantes:', {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? '✓' : '✗',
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? '✓' : '✗'
    })
    
    return new Proxy({} as SupabaseClient, {
      get(_target, prop) {
        if (prop === 'from' || prop === 'auth') {
          return new Proxy({}, {
            get() {
              throw new Error('Missing Supabase environment variables. Configurez-les dans Vercel et redéployez.')
            }
          })
        }
        throw new Error('Missing Supabase environment variables.')
      }
    }) as SupabaseClient
  }
  
  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  return _supabaseAdmin
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const admin = getSupabaseAdmin()
    const value = (admin as any)[prop]
    return typeof value === 'function' ? value.bind(admin) : value
  }
}) as SupabaseClient
```

### Utilisation dans les API Routes Next.js

```typescript
// app/api/example/route.ts
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(req: Request) {
  // Vérifier les variables AVANT utilisation
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Configuration serveur incomplète' },
      { status: 500 }
    )
  }

  const cookieStore = cookies()
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {}, // Pas besoin dans les API routes
      remove() {},
    },
  } as any)
  
  // Utiliser supabase...
}
```

### Gestion des Erreurs Supabase

**⚠️ PROBLÈME CRITIQUE** : Si Supabase n'est pas configuré, le Proxy lance une erreur **synchrone** qui peut bloquer l'application.

**SOLUTION** : Toujours wrapper les appels Supabase dans try-catch :

```typescript
// ❌ MAUVAIS - Peut bloquer si Supabase non configuré
const { data } = await supabase.auth.getSession()

// ✅ BON - Gestion d'erreur robuste
try {
  const testAuth = supabase.auth // Teste si disponible
  if (testAuth && typeof testAuth === 'object') {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('Erreur session:', error)
      // Gérer l'erreur
    }
  }
} catch (e: any) {
  console.warn('Supabase non configuré:', e?.message)
  // Continuer sans Supabase
}
```

### Écoute des Changements d'Authentification

```typescript
useEffect(() => {
  let subscription: { unsubscribe: () => void } | null = null

  try {
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Gérer le changement de session
      setUser(session?.user ?? null)
    })
    subscription = authSubscription
  } catch (error) {
    console.warn('Impossible de s\'abonner:', error)
  }

  return () => {
    if (subscription) {
      subscription.unsubscribe()
    }
  }
}, [])
```

---

## 💳 Configuration Stripe

### Variables d'Environnement Requises

```env
STRIPE_SECRET_KEY=sk_test_... (test) ou sk_live_... (production)
STRIPE_PRICE_ID=price_xxxxx (⚠️ IMPORTANT : commence par "price_", pas "prod_")
STRIPE_WEBHOOK_SECRET=whsec_... (optionnel, pour webhooks)
NEXT_PUBLIC_APP_URL=https://votre-domaine.com (pour les redirections)
```

### Initialisation du Client Stripe

```typescript
// lib/stripe.ts ou directement dans l'API route
import Stripe from 'stripe'

let stripe: Stripe | null = null

if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover', // Utiliser la dernière version
    })
  } catch (error) {
    console.error('Erreur initialisation Stripe:', error)
  }
}
```

### Création d'une Session de Checkout

```typescript
// app/api/checkout/route.ts
import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-11-17.clover' })
  : null

export async function POST(req: Request) {
  // 1. Vérifier que l'utilisateur est connecté
  const userId = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')

  if (!userId || !userEmail) {
    return NextResponse.json(
      { error: 'Vous devez être connecté' },
      { status: 401 }
    )
  }

  // 2. Vérifier Stripe configuré
  if (!stripe || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe non configuré' },
      { status: 500 }
    )
  }

  // 3. Vérifier le Price ID (doit commencer par "price_")
  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId || !priceId.startsWith('price_')) {
    return NextResponse.json(
      { error: 'STRIPE_PRICE_ID invalide. Doit commencer par "price_".' },
      { status: 500 }
    )
  }

  // 4. Détecter l'URL automatiquement (Vercel/Netlify)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
    || process.env.VERCEL_URL 
    || process.env.DEPLOY_PRIME_URL
    || (process.env.NODE_ENV === 'production' 
        ? 'https://votre-domaine.com' 
        : 'http://localhost:3000')
  
  const appUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`

  // 5. Créer la session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', // One-time payment
    payment_method_types: ['card'],
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    customer_email: userEmail,
    metadata: {
      user_id: userId, // ⚠️ CRITIQUE pour associer le premium
      user_email: userEmail,
    },
    success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing`, // ⚠️ IMPORTANT : gérer l'annulation
  })

  return NextResponse.json({ url: session.url })
}
```

### Gestion de l'Annulation Stripe

**⚠️ PROBLÈME** : Quand l'utilisateur annule le paiement, Stripe redirige vers `cancel_url`. Si cette page fait des appels Supabase qui échouent, elle peut rester bloquée.

**SOLUTION** : Ajouter des timeouts et gestion d'erreur robuste :

```typescript
// app/pricing/page.tsx (page de retour après annulation)
useEffect(() => {
  let isMounted = true
  let timeoutId: NodeJS.Timeout | null = null

  // Timeout de sécurité (2-3 secondes max)
  timeoutId = setTimeout(() => {
    if (isMounted) {
      setIsChecking(false)
      setUser(null)
      setIsPremium(false)
    }
  }, 2000)

  const checkAuth = async () => {
    try {
      // Vérifier si Supabase est disponible AVANT utilisation
      let supabaseAvailable = false
      try {
        const testAuth = supabase.auth
        if (testAuth && typeof testAuth === 'object') {
          supabaseAvailable = true
        }
      } catch (e: any) {
        console.warn('Supabase non configuré:', e?.message)
        // Afficher la page quand même
        if (isMounted) {
          setIsChecking(false)
        }
        return
      }

      if (!supabaseAvailable) {
        setIsChecking(false)
        return
      }

      // Continuer avec les appels Supabase...
      const { data: { session } } = await supabase.auth.getSession()
      // ...
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      if (isMounted) {
        setIsChecking(false)
        if (timeoutId) clearTimeout(timeoutId)
      }
    }
  }

  checkAuth()

  return () => {
    isMounted = false
    if (timeoutId) clearTimeout(timeoutId)
  }
}, [])
```

### Vérification du Paiement après Redirection

```typescript
// app/success/page.tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get('session_id')

  if (!sessionId) {
    setIsActivating(false)
    return
  }

  const checkPaymentAndActivate = async () => {
    try {
      const response = await fetch(`/api/check-payment?session_id=${sessionId}`)
      const data = await response.json()

      if (!response.ok) {
        console.error('Erreur API:', data.error)
        setIsActivating(false)
        return
      }

      if (data.paid && data.premium_activated) {
        // Nettoyer le cache
        localStorage.removeItem('premium_status')
        localStorage.removeItem('premium_user_id')
        localStorage.removeItem('premium_cache_time')
        
        // Mettre à jour le cache
        localStorage.setItem('premium_status', 'true')
        // ...
        
        router.push('/app')
      } else {
        // Réessayer après 3 secondes
        setTimeout(checkPaymentAndActivate, 3000)
      }
    } catch (error) {
      console.error('Erreur:', error)
      setTimeout(checkPaymentAndActivate, 3000)
    }
  }

  checkPaymentAndActivate()
}, [])
```

---

## 🤖 Configuration Groq API

### Variable d'Environnement Requise

```env
GROQ_API_KEY=gsk_xxxxx
OPENAI_API_KEY=sk-... (optionnel, fallback)
```

### Utilisation avec OpenAI SDK

```typescript
import OpenAI from 'openai'

const groqApiKey = process.env.GROQ_API_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

// Client Groq (utilise l'API OpenAI mais avec baseURL Groq)
const groqClient = groqApiKey ? new OpenAI({
  apiKey: groqApiKey,
  baseURL: 'https://api.groq.com/openai/v1',
}) : null

// Client OpenAI (fallback)
const openaiClient = openaiApiKey && openaiApiKey !== 'ta_clef_ici' 
  ? new OpenAI({ apiKey: openaiApiKey })
  : null

// Utilisation avec fallback
let optimized: string | null = null
let error: any = null

// Essayer d'abord avec Groq
const groqModels = [
  'llama-3.1-8b-instant',  // Plus rapide
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'llama-3-8b-8192'
]

if (groqClient && groqApiKey) {
  for (const model of groqModels) {
    try {
      const completion = await groqClient.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      })
      optimized = completion.choices[0].message.content
      break // Succès, sortir de la boucle
    } catch (groqError: any) {
      error = groqError
      // Continuer avec le modèle suivant si erreur 429 ou 404
      if (groqError.status === 429 || groqError.status === 404) {
        continue
      } else {
        break // Arrêter pour les autres erreurs
      }
    }
  }
}

// Fallback vers OpenAI si Groq échoue
if (!optimized && openaiClient) {
  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    })
    optimized = completion.choices[0].message.content
  } catch (openaiError: any) {
    error = openaiError
  }
}
```

---

## 🐛 Bugs Critiques et Solutions

### Bug #1 : "Vérification..." Infini sur la Page Pricing

**PROBLÈME** : Après annulation Stripe, la page reste bloquée sur "Vérification..." indéfiniment.

**CAUSE** : 
- Les appels Supabase échouent silencieusement
- `setIsChecking(false)` n'est jamais appelé
- Pas de timeout de sécurité

**SOLUTION** :
```typescript
// 1. Ajouter un timeout de sécurité (2-3 secondes)
const timeoutId = setTimeout(() => {
  setIsChecking(false)
  setUser(null)
  setIsPremium(false)
}, 2000)

// 2. Vérifier Supabase AVANT utilisation
try {
  const testAuth = supabase.auth
  if (testAuth && typeof testAuth === 'object') {
    // Utiliser Supabase
  }
} catch (e) {
  // Supabase non configuré, afficher la page quand même
  setIsChecking(false)
}

// 3. Toujours appeler setIsChecking(false) dans finally
finally {
  setIsChecking(false)
  clearTimeout(timeoutId)
}
```

### Bug #2 : Déconnexion ne Fonctionne pas en Production

**PROBLÈME** : Le bouton "Déconnexion" ne fonctionne pas en production.

**CAUSE** :
- `signOut()` échoue silencieusement
- Le localStorage n'est pas nettoyé
- `router.push()` ne force pas un rechargement complet

**SOLUTION** :
```typescript
const handleSignOut = async () => {
  try {
    // 1. Nettoyer le localStorage AVANT
    if (typeof window !== 'undefined') {
      localStorage.removeItem('premium_status')
      localStorage.removeItem('premium_user_id')
      localStorage.removeItem('premium_cache_time')
    }

    // 2. Essayer de se déconnecter (avec gestion d'erreur)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Erreur déconnexion:', error)
        // Continuer quand même
      }
    } catch (supabaseError) {
      console.error('Supabase non disponible:', supabaseError)
      // Continuer quand même
    }

    // 3. Mettre à jour l'état immédiatement
    setUser(null)

    // 4. Utiliser window.location.href pour forcer un rechargement complet
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    } else {
      router.push('/')
      router.refresh()
    }
  } catch (error) {
    // En cas d'erreur, forcer quand même la redirection
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }
}
```

### Bug #3 : Variables d'Environnement Non Disponibles en Production

**PROBLÈME** : Les variables sont définies dans Vercel mais ne sont pas disponibles au runtime.

**CAUSES POSSIBLES** :
- Variables définies pour le mauvais environnement (Production vs Preview)
- Redéploiement nécessaire après ajout des variables
- Variables avec des espaces ou caractères spéciaux

**SOLUTION** :
1. Vérifier dans Vercel : Settings > Environment Variables
2. S'assurer que les variables sont assignées à "Production"
3. Redéployer après avoir ajouté/modifié des variables
4. Vérifier les logs Vercel pour voir si les variables sont chargées

### Bug #4 : Erreur 429 alors que le Quota est Disponible

**PROBLÈME** : L'utilisateur a 3/3 générations mais reçoit une erreur 429.

**CAUSE** :
- Problème de comparaison de dates (timezone)
- Compteur non réinitialisé correctement
- Race condition lors de l'incrémentation

**SOLUTION** :
```typescript
// Utiliser toujours UTC pour les dates
const today = new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD

// Vérifier et réinitialiser AVANT la vérification de limite
let dailyGenerations = profile.daily_generations || 0
if (profile.last_reset !== today) {
  // Réinitialiser dans la BDD
  await supabaseAdmin
    .from('profiles')
    .update({
      daily_generations: 0,
      last_reset: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  dailyGenerations = 0
}

// Vérifier la limite (>= 3 bloque, donc 4ème génération)
if (dailyGenerations >= 3) {
  return { allowed: false, error: 'Limite atteinte' }
}

// Incrémenter APRÈS la vérification
await supabaseAdmin
  .from('profiles')
  .update({
    daily_generations: dailyGenerations + 1,
    last_reset: today,
  })
  .eq('id', userId)
```

### Bug #5 : Erreur CORS avec Supabase

**PROBLÈME** : Erreur CORS en production avec Supabase.

**CAUSE** :
- Variables d'environnement non chargées
- URL Supabase incorrecte
- Problème de configuration Supabase

**SOLUTION** :
1. Vérifier que `NEXT_PUBLIC_SUPABASE_URL` est correcte (commence par `https://`)
2. Vérifier que `NEXT_PUBLIC_SUPABASE_ANON_KEY` est correcte
3. Redéployer après modification des variables
4. Vérifier les logs Vercel pour les erreurs

### Bug #6 : Compteur IP Désynchronisé entre Affichage et Génération

**PROBLÈME** : Le compteur affiche "3 / 3" (0 génération utilisée) mais la génération est bloquée avec "Limite atteinte".

**CAUSE** :
- `/api/ip/check` utilisait `createClient` avec la clé anonyme (soumis à RLS)
- `/api/generate` utilisait `supabaseAdmin` (bypass RLS)
- Les deux endpoints voyaient des données différentes dans la table `ip_usage`
- Le client voyait 0 générations mais le serveur voyait 3 générations

**SOLUTION** :
```typescript
// ❌ MAUVAIS - Utilise la clé anonyme (soumis à RLS)
// app/api/ip/check/route.ts
const supabase = createClient(supabaseUrl, supabaseAnonKey)
const { data: ipUsage } = await supabase
  .from('ip_usage')
  .select('*')
  .eq('ip_address', ipAddress)
  .single()

// ✅ BON - Utilise supabaseAdmin (même que /api/generate)
// app/api/ip/check/route.ts
import { supabaseAdmin } from '@/lib/supabase-server'

let { data: ipUsage, error } = await supabaseAdmin
  .from('ip_usage')
  .select('*')
  .eq('ip_address', ipAddress)
  .maybeSingle()

// ⚠️ IMPORTANT : Utiliser let au lieu de const si on doit réassigner
let dailyGenerations = ipUsage.daily_generations || 0
if (ipUsage.last_reset !== today) {
  const { data: updated } = await supabaseAdmin
    .from('ip_usage')
    .update({ daily_generations: 0, last_reset: today })
    .eq('ip_address', ipAddress)
    .select()
    .single()
  
  if (updated) {
    ipUsage = updated // ✅ Possible avec let, pas avec const
    dailyGenerations = 0
  }
}
```

**RÈGLE D'OR** : Toujours utiliser `supabaseAdmin` dans les API routes pour avoir accès aux mêmes données, surtout pour les tables avec RLS activé.

### Bug #7 : Section "Générations gratuites" Bloquée sur "Chargement..." après Stripe

**PROBLÈME** : Après avoir quitté Stripe sans payer, la section reste bloquée sur "Chargement..." et nécessite un refresh.

**CAUSE** :
- `isChecking` reste à `true` indéfiniment
- Le timeout de vérification est trop long (500ms)
- La détection du retour depuis Stripe n'est pas fiable
- La section ne s'affiche que si `!isChecking`

**SOLUTION** :
```typescript
// 1. Afficher la section même pendant le chargement (avec état "Chargement...")
{!hasPremium && (
  <div className="mb-6 p-5 rounded-xl border">
    {isChecking ? (
      <p className="text-2xl font-bold text-gray-400">Chargement...</p>
    ) : (
      <>
        <p className="text-2xl font-bold">{remaining} / 3</p>
        <p className="text-xs">{genCount} génération{genCount > 1 ? 's' : ''} utilisée{genCount > 1 ? 's' : ''} sur 3</p>
      </>
    )}
  </div>
)}

// 2. Détecter le retour depuis Stripe de manière fiable
useEffect(() => {
  // Vérifier sessionStorage ET referrer
  const fromStripe = sessionStorage.getItem('from_stripe') === 'true'
  const referrer = document.referrer
  const isFromStripe = fromStripe || referrer.includes('stripe.com') || referrer.includes('checkout.stripe.com')
  
  if (isFromStripe) {
    sessionStorage.removeItem('from_stripe')
    // Timeout réduit pour réponse plus rapide
    setTimeout(() => {
      if (isMountedRef.current) {
        checkStatus(true)
      }
    }, 100) // Réduit de 500ms à 100ms
  }
  
  // Écouter les événements focus (retour sur l'onglet)
  const handleFocus = () => {
    if (!isMountedRef.current) return
    const currentReferrer = document.referrer
    if (currentReferrer.includes('stripe.com') || currentReferrer.includes('checkout.stripe.com')) {
      checkStatus(true)
    }
  }
  
  window.addEventListener('focus', handleFocus)
  return () => window.removeEventListener('focus', handleFocus)
}, [])

// 3. Marquer le retour depuis Stripe dans la page pricing
// app/pricing/page.tsx
useEffect(() => {
  if (typeof window !== 'undefined') {
    const referrer = document.referrer
    if (referrer.includes('stripe.com') || referrer.includes('checkout.stripe.com')) {
      sessionStorage.setItem('from_stripe', 'true')
    }
  }
}, [])
```

### Bug #8 : Rafraîchissement du Compteur après Génération

**PROBLÈME** : Après une génération réussie, le compteur ne se met pas à jour correctement pour les utilisateurs non connectés.

**CAUSE** :
- Utilisation de `fetch('/api/ip/check')` qui peut être mis en cache
- Pas de rafraîchissement forcé après génération
- Le compteur côté client n'est pas synchronisé avec le serveur

**SOLUTION** :
```typescript
// ❌ MAUVAIS - Peut utiliser le cache
const statusResponse = await fetch('/api/ip/check')
const statusData = await statusResponse.json()

// ✅ BON - Force la récupération depuis le serveur
const statusResponse = await fetch('/api/ip/check', {
  cache: 'no-store', // Forcer la récupération depuis le serveur
  headers: {
    'Cache-Control': 'no-cache'
  }
})

// ✅ BON - Rafraîchir avant de bloquer si limite atteinte
if (!isChecking && !hasPremium && remaining <= 0) {
  // Rafraîchir le compteur avant de bloquer (au cas où il serait désynchronisé)
  await checkStatus(true)
  // Attendre un peu pour laisser les states se mettre à jour
  await new Promise(resolve => setTimeout(resolve, 100))
  // Vérifier à nouveau après rafraîchissement
  if (remaining <= 0) {
    setShowLimitError(true)
    return
  }
}
```

### Bug #9 : Infobulles qui Bloquent la Navigation

**PROBLÈME** : Les infobulles de succès/erreur sont positionnées en haut à droite et bloquent les boutons de navigation.

**SOLUTION** :
```typescript
// ❌ MAUVAIS - En haut à droite
<div className="fixed top-4 right-4 z-50">

// ✅ BON - En bas à droite (ne bloque pas la navigation)
<div className="fixed bottom-4 right-4 z-50">
```

**APPLIQUER À** :
- Notifications de succès (génération, connexion, inscription, avis)
- Notifications d'erreur (limite atteinte, erreurs diverses)

---

## ✅ Bonnes Pratiques

### 1. Gestion des Variables d'Environnement

- ✅ Toujours vérifier les variables AVANT utilisation
- ✅ Utiliser des messages d'erreur clairs si manquantes
- ✅ Ne jamais exposer les clés secrètes côté client
- ✅ Utiliser `NEXT_PUBLIC_` uniquement pour les variables publiques

### 2. Gestion d'Erreur Supabase

- ✅ Toujours wrapper les appels Supabase dans try-catch
- ✅ Vérifier si Supabase est disponible avant utilisation
- ✅ Ajouter des timeouts pour éviter les blocages
- ✅ Logger les erreurs pour le débogage

### 3. Gestion des États de Chargement

- ✅ Toujours avoir un timeout de sécurité (2-3 secondes max)
- ✅ Mettre à jour l'état dans `finally` pour garantir l'exécution
- ✅ Utiliser des flags `isMounted` pour éviter les mises à jour après démontage

### 4. Gestion du Cache localStorage

- ✅ Nettoyer le cache lors de la déconnexion
- ✅ Invalider le cache lors des changements importants
- ✅ Ne jamais faire confiance uniquement au cache, toujours vérifier la BDD

### 5. Redirections et Navigation

- ✅ Utiliser `window.location.href` pour forcer un rechargement complet
- ✅ Utiliser `router.push()` pour les navigations normales
- ✅ Toujours nettoyer les états avant redirection

### 6. Synchronisation Client-Serveur

- ✅ Toujours utiliser `supabaseAdmin` dans les API routes pour bypass RLS
- ✅ Utiliser `cache: 'no-store'` pour forcer la récupération depuis le serveur
- ✅ Rafraîchir le compteur avant de bloquer si limite atteinte (éviter faux positifs)
- ✅ Utiliser `let` au lieu de `const` si on doit réassigner la variable plus tard

### 7. Détection du Retour depuis Stripe

- ✅ Utiliser `sessionStorage` pour marquer le retour depuis Stripe
- ✅ Vérifier `document.referrer` pour détecter le retour
- ✅ Écouter les événements `focus` pour détecter le retour sur l'onglet
- ✅ Réduire les timeouts (100ms au lieu de 500ms) pour réponse plus rapide
- ✅ Afficher la section même pendant le chargement (avec état "Chargement...")

### 8. Positionnement des Notifications

- ✅ Toujours positionner les infobulles en bas à droite (`bottom-4 right-4`)
- ✅ Ne jamais bloquer les éléments de navigation avec les notifications
- ✅ Utiliser `z-50` pour s'assurer que les notifications sont au-dessus

---

## 🎯 Patterns qui Fonctionnent

### Pattern 1 : Initialisation Lazy avec Proxy

```typescript
// Permet au build de réussir même si les variables ne sont pas définies
let _client: Client | null = null

function getClient(): Client {
  if (_client) return _client
  
  const key = process.env.API_KEY
  if (!key) {
    return new Proxy({} as Client, {
      get() {
        throw new Error('API_KEY manquante')
      }
    }) as Client
  }
  
  _client = createClient(key)
  return _client
}

export const client = new Proxy({} as Client, {
  get(_target, prop) {
    const instance = getClient()
    const value = (instance as any)[prop]
    return typeof value === 'function' ? value.bind(instance) : value
  }
}) as Client
```

### Pattern 2 : Vérification avec Timeout

```typescript
const checkWithTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = 2000
): Promise<T | null> => {
  try {
    const result = await Promise.race([
      promise,
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ])
    return result as T
  } catch (error) {
    console.warn('Timeout ou erreur:', error)
    return null
  }
}

// Utilisation
const session = await checkWithTimeout(supabase.auth.getSession(), 2000)
```

### Pattern 3 : Gestion d'État avec Cleanup

```typescript
useEffect(() => {
  let isMounted = true
  let timeoutId: NodeJS.Timeout | null = null
  let subscription: { unsubscribe: () => void } | null = null

  const cleanup = () => {
    isMounted = false
    if (timeoutId) clearTimeout(timeoutId)
    if (subscription) subscription.unsubscribe()
  }

  // Logique...

  return cleanup
}, [])
```

### Pattern 4 : Fallback pour les APIs

```typescript
// Essayer plusieurs options dans l'ordre
let result = null
let error = null

// Option 1 : Groq
if (groqClient) {
  try {
    result = await groqClient.chat.completions.create({...})
  } catch (e) {
    error = e
  }
}

// Option 2 : OpenAI (fallback)
if (!result && openaiClient) {
  try {
    result = await openaiClient.chat.completions.create({...})
  } catch (e) {
    error = e
  }
}

// Gérer l'erreur si toutes les options échouent
if (!result) {
  return NextResponse.json({ error: 'Tous les services sont indisponibles' }, { status: 500 })
}
```

### Pattern 5 : Synchronisation du Compteur IP

```typescript
// ⚠️ CRITIQUE : Toujours utiliser supabaseAdmin dans les API routes
// pour avoir les mêmes données que /api/generate

// app/api/ip/check/route.ts
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const ipAddress = getClientIP(request)
  const today = new Date().toISOString().split('T')[0]
  
  // Utiliser supabaseAdmin (même que /api/generate)
  let { data: ipUsage, error } = await supabaseAdmin
    .from('ip_usage')
    .select('*')
    .eq('ip_address', ipAddress)
    .maybeSingle()
  
  // Si pas d'entrée, retourner 0 générations
  if (!ipUsage) {
    return NextResponse.json({
      daily_generations: 0,
      remaining: 3,
      can_generate: true
    })
  }
  
  // Réinitialiser si nécessaire
  let dailyGenerations = ipUsage.daily_generations || 0
  if (ipUsage.last_reset !== today) {
    const { data: updated } = await supabaseAdmin
      .from('ip_usage')
      .update({ daily_generations: 0, last_reset: today })
      .eq('ip_address', ipAddress)
      .select()
      .single()
    
    if (updated) {
      ipUsage = updated // ✅ Possible avec let
      dailyGenerations = 0
    }
  }
  
  return NextResponse.json({
    daily_generations: dailyGenerations,
    remaining: Math.max(0, 3 - dailyGenerations),
    can_generate: dailyGenerations < 3
  })
}
```

### Pattern 6 : Détection du Retour depuis Stripe

```typescript
// 1. Marquer le retour dans la page pricing
// app/pricing/page.tsx
useEffect(() => {
  if (typeof window !== 'undefined') {
    const referrer = document.referrer
    if (referrer.includes('stripe.com') || referrer.includes('checkout.stripe.com')) {
      sessionStorage.setItem('from_stripe', 'true')
    }
  }
}, [])

// 2. Détecter et réagir dans la page app
// app/app/page.tsx
useEffect(() => {
  // Vérifier sessionStorage ET referrer
  const fromStripe = sessionStorage.getItem('from_stripe') === 'true'
  const referrer = document.referrer
  const isFromStripe = fromStripe || referrer.includes('stripe.com')
  
  if (isFromStripe) {
    sessionStorage.removeItem('from_stripe')
    // Rafraîchir rapidement le statut
    setTimeout(() => {
      if (isMountedRef.current) {
        checkStatus(true)
      }
    }, 100) // Timeout court pour réponse rapide
  }
  
  // Écouter les événements focus
  const handleFocus = () => {
    if (!isMountedRef.current) return
    const currentReferrer = document.referrer
    if (currentReferrer.includes('stripe.com')) {
      checkStatus(true)
    }
  }
  
  window.addEventListener('focus', handleFocus)
  return () => window.removeEventListener('focus', handleFocus)
}, [])
```

### Pattern 7 : Rafraîchissement Forcé du Compteur

```typescript
// Côté client - Forcer la récupération depuis le serveur
const response = await fetch('/api/ip/check', {
  cache: 'no-store', // ⚠️ IMPORTANT : bypass le cache
  headers: {
    'Cache-Control': 'no-cache'
  }
})

// Après génération - Rafraîchir avant de bloquer
if (!hasPremium && remaining <= 0) {
  // Rafraîchir avant de bloquer (éviter faux positifs)
  await checkStatus(true)
  await new Promise(resolve => setTimeout(resolve, 100))
  // Vérifier à nouveau
  if (remaining <= 0) {
    setShowLimitError(true)
    return
  }
}
```

---

## 📝 Checklist pour une Nouvelle Application

### Configuration Initiale
- [ ] Créer le projet Supabase
- [ ] Récupérer les clés (URL, anon key, service role key)
- [ ] Créer le projet Stripe
- [ ] Créer un produit et récupérer le Price ID (commence par `price_`)
- [ ] Obtenir la clé API Groq
- [ ] Configurer toutes les variables dans Vercel

### Code
- [ ] Créer `lib/supabase.ts` avec initialisation lazy
- [ ] Créer `lib/supabase-server.ts` pour les API routes
- [ ] Ajouter gestion d'erreur partout
- [ ] Ajouter des timeouts de sécurité
- [ ] Tester la déconnexion
- [ ] Tester les redirections Stripe (success et cancel)

### Tests en Production
- [ ] Vérifier que les variables sont chargées (logs Vercel)
- [ ] Tester la connexion/déconnexion
- [ ] Tester le checkout Stripe
- [ ] Tester l'annulation Stripe
- [ ] Vérifier que les timeouts fonctionnent
- [ ] Vérifier que les erreurs sont gérées gracieusement

---

## 🔍 Debugging

### Vérifier les Variables d'Environnement

```typescript
// Dans une API route
console.log('Variables:', {
  NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
  GROQ_API_KEY: !!process.env.GROQ_API_KEY,
})
```

### Logs Utiles

```typescript
// Toujours logger avec un préfixe pour identifier la source
console.log('[API_GENERATE] Vérification quota:', { userId, dailyGenerations })
console.error('[HEADER] Erreur déconnexion:', error)
console.warn('[PRICING] Supabase non configuré')
```

---

## 🚀 Conclusion

Les points clés à retenir :

1. **Toujours vérifier les variables d'environnement avant utilisation**
2. **Ajouter des timeouts de sécurité partout** (2-3 secondes max)
3. **Gérer les erreurs gracieusement** - ne jamais bloquer l'utilisateur
4. **Utiliser `window.location.href` pour les redirections critiques**
5. **Nettoyer le localStorage lors de la déconnexion**
6. **Tester en production** - les problèmes apparaissent souvent seulement là
7. **Toujours utiliser `supabaseAdmin` dans les API routes** pour bypass RLS et avoir les mêmes données
8. **Forcer le rafraîchissement du cache** avec `cache: 'no-store'` pour les données critiques
9. **Positionner les notifications en bas à droite** pour ne pas bloquer la navigation
10. **Utiliser `let` au lieu de `const`** si on doit réassigner la variable plus tard

## 📊 Architecture de l'Application

### Flux de Génération de Prompts

```
1. Utilisateur entre du texte dans /app
   ↓
2. Clic sur "Générer"
   ↓
3. Vérification côté client (remaining > 0)
   ↓
4. POST /api/generate
   ↓
5. checkAndIncrementGenerations()
   ├─ Si connecté : Vérifier profiles.daily_generations
   └─ Si non connecté : Vérifier ip_usage.daily_generations
   ↓
6. Si limite atteinte : Retourner 429
   ↓
7. Si OK : Incrémenter compteur + Générer prompt avec Groq/OpenAI
   ↓
8. Retourner le prompt optimisé
   ↓
9. Côté client : Rafraîchir le compteur depuis /api/ip/check ou profiles
```

### Flux de Paiement Stripe

```
1. Utilisateur clique "Acheter Premium" dans /pricing
   ↓
2. POST /api/checkout
   ├─ Vérifier authentification
   ├─ Créer session Stripe avec metadata (user_id, user_email)
   └─ Retourner URL de checkout
   ↓
3. Redirection vers Stripe Checkout
   ↓
4a. Paiement réussi → /success?session_id=xxx
   ├─ GET /api/check-payment?session_id=xxx
   ├─ Vérifier paiement avec Stripe
   ├─ Mettre à jour profiles.is_premium = true
   └─ Redirection vers /app
   ↓
4b. Paiement annulé → /pricing
   ├─ Détecter retour depuis Stripe (referrer + sessionStorage)
   ├─ Vérifier statut premium (doit être false)
   └─ Afficher page pricing normale
```

### Gestion du Compteur IP

```
Table ip_usage :
- ip_address (string, unique)
- daily_generations (integer, default 0)
- last_reset (date, format YYYY-MM-DD)
- unlimited_prompt (boolean, default false)
- is_premium (boolean, legacy, default false)

Logique :
1. Récupérer ou créer entrée pour IP
2. Si last_reset !== today : Réinitialiser daily_generations = 0
3. Si daily_generations >= 3 : Bloquer génération
4. Sinon : Incrémenter daily_generations + 1
```

### Points Critiques de Synchronisation

1. **Compteur IP** : `/api/ip/check` et `/api/generate` doivent utiliser `supabaseAdmin` pour voir les mêmes données
2. **Statut Premium** : Vérifier depuis la BDD après retour depuis Stripe, pas depuis le cache
3. **Compteur Utilisateur** : Rafraîchir après chaque génération pour synchronisation client-serveur
4. **Cache localStorage** : Invalider lors de la déconnexion et après paiement Stripe

Ce guide couvre tous les problèmes rencontrés et leurs solutions. Utilisez-le comme référence pour créer de nouvelles applications plus efficacement.

