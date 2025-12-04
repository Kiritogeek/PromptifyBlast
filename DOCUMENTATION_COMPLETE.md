# 📚 Documentation Complète - PromptifyBlast

## 🎯 Vue d'ensemble

**PromptifyBlast** est une application SaaS de génération de prompts IA optimisés. L'application permet aux utilisateurs de transformer leurs idées en prompts parfaitement structurés pour les modèles d'IA, avec plusieurs modes d'optimisation.

### Fonctionnalités principales
- ✅ Génération de prompts optimisés via IA (Groq/OpenAI)
- ✅ 3 modes de génération : Basique, Pro, Ultra-Optimisé
- ✅ Système freemium : 3 générations gratuites/jour, Premium illimité
- ✅ Sélection du modèle cible (ChatGPT, Gemini, Grok) - Premium uniquement
- ✅ Authentification utilisateur (Supabase Auth)
- ✅ Paiement unique 5€ via Stripe
- ✅ Tracking par IP pour utilisateurs non connectés
- ✅ Interface dark mode moderne et responsive

---

## 🏗️ Architecture Technique

### Stack Technologique
- **Framework** : Next.js 14 (App Router)
- **Langage** : TypeScript
- **Styling** : TailwindCSS
- **Base de données** : Supabase (PostgreSQL)
- **Authentification** : Supabase Auth
- **Paiements** : Stripe Checkout
- **IA** : Groq API (primary), OpenAI API (fallback)

### Structure du Projet
```
PromptifyBlast/
├── app/
│   ├── api/                    # API Routes
│   │   ├── auth/
│   │   │   └── check/          # Vérification statut utilisateur
│   │   ├── checkout/           # Initiation Stripe Checkout
│   │   ├── check-payment/      # Vérification paiement Stripe
│   │   ├── generate/           # Génération de prompts IA
│   │   ├── ip/
│   │   │   ├── check/          # Vérification IP usage
│   │   │   └── increment/      # Incrément compteur IP
│   │   └── webhooks/
│   │       └── stripe/         # Webhook Stripe (optionnel)
│   ├── app/                    # Page générateur principal
│   ├── login/                  # Page connexion/inscription
│   ├── pricing/                # Page Premium
│   ├── success/                # Page succès paiement
│   ├── layout.tsx              # Layout principal
│   ├── page.tsx                # Page d'accueil
│   └── globals.css             # Styles globaux
├── components/
│   ├── Header.tsx              # Header avec navigation
│   └── Auth.tsx                # Composant auth (non utilisé)
├── lib/
│   ├── supabase.ts             # Client Supabase (client-side)
│   └── supabase-server.ts      # Client Supabase (server-side)
├── next.config.js              # Configuration Next.js
├── package.json                # Dépendances
└── tailwind.config.js          # Configuration TailwindCSS
```

---

## 🗄️ Base de Données (Supabase)

### Tables

#### 1. `profiles` (Utilisateurs connectés)
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium BOOLEAN DEFAULT FALSE NOT NULL,
  unlimited_prompt BOOLEAN DEFAULT FALSE NOT NULL,
  premium_until TIMESTAMP WITH TIME ZONE,
  daily_generations INTEGER DEFAULT 0 NOT NULL,
  last_reset DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

**Colonnes** :
- `id` : UUID de l'utilisateur (référence `auth.users.id`)
- `is_premium` : Statut premium (true = premium activé)
- `unlimited_prompt` : Générations illimitées (true = illimité, false = limité à 3/jour)
- `premium_until` : Date d'expiration premium (null pour paiement unique)
- `daily_generations` : Nombre de générations effectuées aujourd'hui
- `last_reset` : Date du dernier reset du compteur quotidien

#### 2. `ip_usage` (Utilisateurs non connectés)
```sql
CREATE TABLE public.ip_usage (
  ip_address TEXT PRIMARY KEY,
  daily_generations INTEGER DEFAULT 0 NOT NULL,
  last_reset DATE DEFAULT CURRENT_DATE NOT NULL,
  is_premium BOOLEAN DEFAULT FALSE NOT NULL,
  unlimited_prompt BOOLEAN DEFAULT FALSE NOT NULL,
  premium_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

**Colonnes** :
- `ip_address` : Adresse IP du client (clé primaire)
- `is_premium` : Statut premium (true = premium activé)
- `unlimited_prompt` : Générations illimitées (true = illimité, false = limité à 3/jour)
- `daily_generations` : Nombre de générations effectuées aujourd'hui
- `last_reset` : Date du dernier reset du compteur quotidien

### Index
```sql
-- Index pour améliorer les performances
CREATE INDEX idx_profiles_last_reset ON public.profiles(last_reset);
CREATE INDEX idx_profiles_is_premium ON public.profiles(is_premium);
CREATE INDEX idx_profiles_unlimited_prompt ON public.profiles(unlimited_prompt);
CREATE INDEX idx_profiles_updated_at ON public.profiles(updated_at);

CREATE INDEX idx_ip_usage_last_reset ON public.ip_usage(last_reset);
CREATE INDEX idx_ip_usage_is_premium ON public.ip_usage(is_premium);
CREATE INDEX idx_ip_usage_unlimited_prompt ON public.ip_usage(unlimited_prompt);
CREATE INDEX idx_ip_usage_updated_at ON public.ip_usage(updated_at);
```

### Triggers et Fonctions

#### 1. Synchronisation `unlimited_prompt` avec `is_premium`
```sql
-- Fonction pour profiles
CREATE OR REPLACE FUNCTION sync_unlimited_prompt_profiles()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_premium = TRUE THEN
    NEW.unlimited_prompt := TRUE;
  END IF;
  IF NEW.is_premium = FALSE THEN
    NEW.unlimited_prompt := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trigger_sync_unlimited_prompt_profiles
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_unlimited_prompt_profiles();
```

#### 2. Création automatique du profil à l'inscription
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, daily_generations, last_reset, is_premium, unlimited_prompt)
  VALUES (NEW.id, 0, CURRENT_DATE, FALSE, FALSE)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### 3. Mise à jour automatique de `updated_at`
```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ip_usage_updated_at
  BEFORE UPDATE ON public.ip_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### Row Level Security (RLS)

#### Politiques pour `profiles`
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent lire leur propre profil
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Le service role peut tout faire (bypass RLS)
CREATE POLICY "Service role can do everything on profiles"
  ON public.profiles FOR ALL
  USING (true) WITH CHECK (true);
```

#### Politiques pour `ip_usage`
```sql
ALTER TABLE public.ip_usage ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire/insérer/mettre à jour (pour tracking IP)
CREATE POLICY "Anyone can read IP usage" ON public.ip_usage FOR SELECT USING (true);
CREATE POLICY "Anyone can insert IP usage" ON public.ip_usage FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update IP usage" ON public.ip_usage FOR UPDATE USING (true) WITH CHECK (true);

-- Le service role peut tout faire
CREATE POLICY "Service role can do everything on ip_usage"
  ON public.ip_usage FOR ALL
  USING (true) WITH CHECK (true);
```

---

## 🔐 Configuration Environnement

### Variables d'environnement (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_... (ou sk_live_... en production)
STRIPE_PRICE_ID=price_... (ID du prix Stripe, pas le Product ID)
NEXT_PUBLIC_APP_URL=http://localhost:3000 (ou votre domaine en production)
STRIPE_WEBHOOK_SECRET=whsec_... (optionnel, pour webhooks)

# IA (Groq - Primary)
GROQ_API_KEY=votre_groq_api_key

# IA (OpenAI - Fallback, optionnel)
OPENAI_API_KEY=sk-... (optionnel)
```

### Où trouver les clés

1. **Supabase** :
   - URL et Anon Key : Dashboard Supabase → Settings → API
   - Service Role Key : Dashboard Supabase → Settings → API → `service_role` key (⚠️ SECRET)

2. **Stripe** :
   - Secret Key : Dashboard Stripe → Developers → API keys
   - Price ID : Dashboard Stripe → Products → Créer un produit → Prix → Copier l'ID (commence par `price_`)
   - Webhook Secret : Dashboard Stripe → Developers → Webhooks → Créer un endpoint → Copier le secret

3. **Groq** :
   - API Key : https://console.groq.com → API Keys → Créer une clé

4. **OpenAI** (optionnel) :
   - API Key : https://platform.openai.com/api-keys

---

## 📄 Pages

### 1. Page d'accueil (`/`)
- **Fichier** : `app/page.tsx`
- **Description** : Landing page avec présentation du service
- **Fonctionnalités** :
  - Titre : "Generate Better Prompts Instantly"
  - Sous-titre : "Transform any idea into a perfect AI-ready prompt."
  - CTA vers `/app`
  - 3 features avec icônes (⚡ Rapide, 🎯 Précis, 🚀 Puissant)

### 2. Générateur (`/app`)
- **Fichier** : `app/app/page.tsx`
- **Description** : Page principale de génération de prompts
- **Fonctionnalités** :
  - Textarea pour saisir le prompt initial
  - Sélection de mode (Basique, Pro, Ultra-Optimisé)
  - Sélection du modèle cible (ChatGPT, Gemini, Grok) - Premium uniquement
  - Bouton "Générer"
  - Affichage du compteur de générations gratuites (X / 3)
  - Bouton "Passer au Premium"
  - Message : "Plus votre prompt initial est précis, plus la réponse sera précise également"
  - Bouton copier
  - Notifications de succès/erreur

**Logique freemium** :
- Utilisateurs non connectés : Tracking par IP (`ip_usage`)
- Utilisateurs connectés : Tracking par profil (`profiles`)
- Premium : Générations illimitées, accès à tous les modes
- Non-premium : 3 générations/jour, uniquement mode Basique

**Modes de génération** :
- **Basique** : Disponible pour tous (gratuit et premium) - Optimisation classique simple
- **Pro** : Premium uniquement - Optimisation complète et détaillée, comprend profondément le besoin
- **Ultra-Optimisé** : Premium uniquement - Optimisation maximale avec prompt complet et détaillé

**Modèle Cible** :
- Permet de sélectionner le modèle IA cible (ChatGPT, Gemini, Grok) pour optimiser le prompt spécifiquement pour ce modèle
- 1 choix maximum
- Disponible uniquement pour les utilisateurs Premium

### 3. Connexion/Inscription (`/login`)
- **Fichier** : `app/login/page.tsx`
- **Description** : Page d'authentification
- **Fonctionnalités** :
  - Toggle entre connexion et inscription
  - Champ email
  - Champ mot de passe avec icône œil (masquer/afficher)
  - Champ confirmation de mot de passe (inscription uniquement)
  - Validation : mots de passe doivent correspondre
  - Traduction des erreurs Supabase en français
  - Connexion automatique après inscription (si email confirmation désactivée)
  - Redirection vers `/pricing` si `?redirect=/pricing` dans l'URL

### 4. Premium (`/pricing`)
- **Fichier** : `app/pricing/page.tsx`
- **Description** : Page de présentation de l'offre Premium
- **Fonctionnalités** :
  - Layout centré avec une seule carte Premium
  - Plan premium : Générations illimitées, tous les modes, sélection du modèle cible, 5€ paiement unique
  - Bouton d'achat Stripe (redirection vers checkout)
  - Bouton "Acheter Premium" → Stripe Checkout
  - Si utilisateur non connecté : Bouton "Connectez-vous pour passer Premium" → `/login?redirect=/pricing`
  - Si utilisateur premium : Bouton vert "Premium ✓" (non cliquable)

### 5. Succès paiement (`/success`)
- **Fichier** : `app/success/page.tsx`
- **Description** : Page affichée après un paiement Stripe réussi
- **Fonctionnalités** :
  - Récupération du `session_id` depuis l'URL
  - Appel à `/api/check-payment` pour vérifier le paiement
  - Activation automatique du premium dans Supabase
  - Retry mechanism (10 tentatives avec délai)
  - Redirection vers `/app` après activation

---

## 🔌 API Routes

### 1. `/api/generate` (POST)
- **Fichier** : `app/api/generate/route.ts`
- **Description** : Génère un prompt optimisé via IA
- **Body** :
  ```json
  {
    "text": "Votre prompt initial",
    "mode": "basic" | "pro" | "ultra-optimized",
    "targetModel": "chatgpt" | "gemini" | "gork" | null
  }
  ```
- **Headers** :
  - `x-user-id` : ID utilisateur (optionnel, pour utilisateurs connectés)
- **Logique** :
  1. Vérifie si l'utilisateur est connecté (via `x-user-id` header ou cookies)
  2. Si connecté : Utilise `profiles` table
  3. Si non connecté : Utilise `ip_usage` table (via IP)
  4. Vérifie la limite de générations (3/jour pour non-premium, illimité pour premium)
  5. Reset automatique si `last_reset < CURRENT_DATE`
  6. Incrémente le compteur si génération autorisée
  7. Appelle Groq API (primary) ou OpenAI API (fallback)
  8. Retourne le prompt optimisé

**Modèles IA utilisés** :
- Primary : Groq (`llama-3.1-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`, `llama-3-8b-8192`)
- Fallback : OpenAI (`gpt-3.5-turbo`, `gpt-4o-mini`)

**Prompt système** :
- Préserve la langue du prompt initial (défaut : français)
- Structure le prompt de manière optimale selon le mode

### 2. `/api/checkout` (POST)
- **Fichier** : `app/api/checkout/route.ts`
- **Description** : Initie une session Stripe Checkout
- **Body** : Aucun (utilise les cookies pour identifier l'utilisateur)
- **Logique** :
  1. Vérifie que l'utilisateur est connecté (sinon erreur 401)
  2. Récupère l'email de l'utilisateur
  3. Crée une session Stripe Checkout
  4. Ajoute `user_id` et `ip_address` dans les metadata
  5. Retourne l'URL de checkout

**Stripe Session** :
- Mode : `payment` (paiement unique)
- Prix : `STRIPE_PRICE_ID` (5€)
- Metadata : `user_id`, `ip_address`

### 3. `/api/check-payment` (GET)
- **Fichier** : `app/api/check-payment/route.ts`
- **Description** : Vérifie le statut d'un paiement Stripe et active le premium
- **Query** : `?session_id=cs_test_...`
- **Logique** :
  1. Récupère le `session_id` depuis l'URL
  2. Appelle Stripe API pour récupérer la session
  3. Vérifie que `payment_status === 'paid'`
  4. Récupère `user_id` depuis les metadata de la session
  5. Met à jour `profiles` : `is_premium = true`, `unlimited_prompt = true`
  6. Retourne le statut

### 4. `/api/auth/check` (GET)
- **Fichier** : `app/api/auth/check/route.ts`
- **Description** : Vérifie le statut premium et les générations restantes d'un utilisateur connecté
- **Logique** :
  1. Récupère l'utilisateur depuis les cookies
  2. Vérifie/reset le compteur quotidien si nécessaire
  3. Retourne `unlimited_prompt`, `daily_generations`, `remaining`

### 5. `/api/ip/check` (GET)
- **Fichier** : `app/api/ip/check/route.ts`
- **Description** : Vérifie le statut premium et les générations restantes d'une IP
- **Logique** :
  1. Récupère l'IP depuis les headers (`x-forwarded-for` ou `x-real-ip`)
  2. Vérifie/reset le compteur quotidien si nécessaire
  3. Retourne `unlimited_prompt`, `daily_generations`, `remaining`

### 6. `/api/ip/increment` (POST)
- **Fichier** : `app/api/ip/increment/route.ts`
- **Description** : Incrémente le compteur de générations pour une IP
- **Body** :
  ```json
  {
    "ip": "192.168.1.1"
  }
  ```

### 7. `/api/webhooks/stripe` (POST)
- **Fichier** : `app/api/webhooks/stripe/route.ts`
- **Description** : Webhook Stripe pour traiter les événements de paiement (optionnel)
- **Événements** : `checkout.session.completed`
- **Logique** :
  1. Vérifie la signature du webhook (si `STRIPE_WEBHOOK_SECRET` est défini)
  2. Récupère `user_id` depuis les metadata
  3. Met à jour `profiles` : `is_premium = true`, `unlimited_prompt = true`

**Note** : Le webhook est optionnel car `/api/check-payment` gère déjà l'activation premium directement.

---

## 🎨 Composants

### 1. `Header.tsx`
- **Fichier** : `components/Header.tsx`
- **Description** : Header avec navigation et authentification
- **Fonctionnalités** :
  - Logo "PromptifyBlast" (lien vers `/`)
  - Liens : "Générateur" (`/app`), "Premium" (`/pricing`)
  - Si connecté : Email utilisateur + Bouton "Déconnexion"
  - Si non connecté : Bouton "Connexion" (`/login`)

### 2. `Auth.tsx`
- **Fichier** : `components/Auth.tsx`
- **Description** : Composant auth (non utilisé actuellement)

---

## 🔧 Bibliothèques

### 1. `lib/supabase.ts`
- **Client Supabase côté client**
- Utilise `createClientComponentClient` de `@supabase/auth-helpers-nextjs`
- Pour les opérations côté client (login, signup, etc.)

### 2. `lib/supabase-server.ts`
- **Client Supabase côté serveur**
- Utilise `createClient` de `@supabase/supabase-js`
- Exporte `supabaseAdmin` (avec `SUPABASE_SERVICE_ROLE_KEY`) pour bypass RLS
- Pour les API routes

---

## 💳 Système Freemium

### Logique de tracking

1. **Utilisateurs connectés** :
   - Utilise la table `profiles`
   - Clé : `id` (UUID de l'utilisateur)
   - Si l'utilisateur se connecte, son IP est ignorée (empêche la création de plusieurs comptes)

2. **Utilisateurs non connectés** :
   - Utilise la table `ip_usage`
   - Clé : `ip_address` (adresse IP du client)
   - Récupération IP : `x-forwarded-for` ou `x-real-ip` headers

### Limites

- **Non-premium** :
  - 3 générations par jour
  - Mode Basique uniquement
  - Pas d'accès à la sélection du modèle cible
  - Reset quotidien automatique (si `last_reset < CURRENT_DATE`)

- **Premium** :
  - Générations illimitées (`unlimited_prompt = true`)
  - Accès à tous les modes (Basique, Pro, Ultra-Optimisé)
  - Accès à la sélection du modèle cible (ChatGPT, Gemini, Grok)
  - Paiement unique 5€

### Reset quotidien

Le compteur `daily_generations` est automatiquement réinitialisé à 0 si `last_reset < CURRENT_DATE`. Cette vérification est effectuée :
- Avant chaque génération (`/api/generate`)
- Lors de la vérification du statut (`/api/auth/check`, `/api/ip/check`)

---

## 🚀 Déploiement

### Prérequis
- Node.js 18+
- Compte Supabase
- Compte Stripe
- Compte Groq (ou OpenAI)

### Installation locale

1. **Cloner le projet**
   ```bash
   git clone <repo-url>
   cd PromptifyBlast
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer `.env.local`**
   - Créer le fichier `.env.local` à la racine
   - Ajouter toutes les variables d'environnement (voir section Configuration)

4. **Configurer Supabase**
   - Créer un projet Supabase
   - Exécuter le schéma SQL dans l'éditeur SQL de Supabase
   - Désactiver la confirmation d'email : Settings → Authentication → Email Auth → Désactiver "Confirm email"

5. **Configurer Stripe**
   - Créer un produit avec un prix de 5€ (paiement unique)
   - Copier le Price ID (commence par `price_`)
   - Ajouter le Price ID dans `.env.local`

6. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```

7. **Accéder à l'application**
   - Ouvrir http://localhost:3000

### Déploiement en production (Vercel)

1. **Préparer le projet**
   ```bash
   npm run build
   ```

2. **Déployer sur Vercel**
   - Connecter le repo GitHub à Vercel
   - Ajouter toutes les variables d'environnement dans Vercel Dashboard
   - Déployer

3. **Configurer Stripe Webhook (optionnel)**
   - Dans Stripe Dashboard → Webhooks
   - Créer un endpoint : `https://votre-domaine.com/api/webhooks/stripe`
   - Sélectionner l'événement : `checkout.session.completed`
   - Copier le webhook secret dans `.env.local` → `STRIPE_WEBHOOK_SECRET`

4. **Mettre à jour `NEXT_PUBLIC_APP_URL`**
   - Dans `.env.local` (ou Vercel), mettre à jour avec votre domaine de production

---

## 🐛 Dépannage

### Erreurs courantes

1. **"Utilisateur non connecté" lors du checkout**
   - Vérifier que l'utilisateur est bien connecté avant d'accéder à `/pricing`
   - Vérifier que les cookies Supabase sont présents

2. **"Limite de requêtes atteinte" (Groq/OpenAI)**
   - Vérifier les clés API dans `.env.local`
   - Vérifier les quotas sur Groq/OpenAI Dashboard
   - Le système utilise automatiquement le fallback si le primary échoue

3. **Premium non activé après paiement**
   - Vérifier que `/api/check-payment` est appelé depuis `/success`
   - Vérifier que `STRIPE_SECRET_KEY` est correct
   - Vérifier que `user_id` est bien dans les metadata de la session Stripe

4. **Erreur d'hydratation Next.js**
   - Vérifier que `hasPremium` est initialisé à `false` côté serveur et client
   - Vérifier que `localStorage` n'est pas utilisé dans `useState` initial

5. **"Email not confirmed" lors de la connexion**
   - Désactiver la confirmation d'email dans Supabase : Settings → Authentication → Email Auth → Désactiver "Confirm email"

---

## 📝 Notes importantes

1. **Sécurité** :
   - Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client
   - Utiliser `supabaseAdmin` uniquement dans les API routes
   - Vérifier toujours que l'utilisateur est connecté avant d'accéder aux fonctionnalités premium

2. **Performance** :
   - Le système utilise `localStorage` pour cacher le statut premium et éviter les "flash" de chargement
   - Les vérifications de statut sont throttlées (toutes les 30 secondes)

3. **Scalabilité** :
   - Les index sur `last_reset`, `is_premium`, `unlimited_prompt` améliorent les performances
   - Le reset quotidien est effectué à la demande (pas de cron job nécessaire)

4. **Compatibilité** :
   - L'application est responsive (mobile, tablette, desktop)
   - Compatible avec les navigateurs modernes (Chrome, Firefox, Safari, Edge)

---

## 📞 Support

Pour toute question ou problème, consulter :
- Documentation Supabase : https://supabase.com/docs
- Documentation Stripe : https://stripe.com/docs
- Documentation Groq : https://console.groq.com/docs
- Documentation Next.js : https://nextjs.org/docs

---

**Dernière mise à jour** : 2024

