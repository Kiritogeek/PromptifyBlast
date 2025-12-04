# Configuration des Variables d'Environnement sur Vercel

## Variables Requises

Pour que l'application fonctionne correctement, vous devez configurer les variables d'environnement suivantes dans Vercel :

### Variables Supabase (OBLIGATOIRES)

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Description : URL de votre projet Supabase
   - Format : `https://xxxxx.supabase.co`
   - Où trouver : Dashboard Supabase > Settings > API > Project URL

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Description : Clé publique (anon) de votre projet Supabase
   - Format : Clé longue commençant par `eyJ...`
   - Où trouver : Dashboard Supabase > Settings > API > Project API keys > `anon` `public`

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Description : Clé de service (service_role) de votre projet Supabase
   - Format : Clé longue commençant par `eyJ...`
   - Où trouver : Dashboard Supabase > Settings > API > Project API keys > `service_role` `secret`
   - ⚠️ **IMPORTANT** : Ne jamais exposer cette clé côté client !

### Variables Stripe (OBLIGATOIRES pour les paiements)

4. **STRIPE_SECRET_KEY**
   - Description : Clé secrète Stripe
   - Format : `sk_test_...` (test) ou `sk_live_...` (production)
   - Où trouver : Dashboard Stripe > Developers > API keys > Secret key

5. **STRIPE_PRICE_ID**
   - Description : ID du prix Stripe pour l'abonnement Premium
   - Format : `price_xxxxx`
   - Où trouver : Dashboard Stripe > Products > Votre produit > Price ID

6. **STRIPE_WEBHOOK_SECRET** (Optionnel)
   - Description : Secret du webhook Stripe
   - Format : `whsec_xxxxx`
   - Où trouver : Dashboard Stripe > Developers > Webhooks > Signing secret

### Variables API IA (OBLIGATOIRES)

7. **GROQ_API_KEY**
   - Description : Clé API Groq pour la génération de prompts
   - Format : `gsk_xxxxx`
   - Où trouver : https://console.groq.com/keys

8. **OPENAI_API_KEY** (Optionnel, fallback)
   - Description : Clé API OpenAI (utilisée en fallback si Groq échoue)
   - Format : `sk-xxxxx`
   - Où trouver : https://platform.openai.com/api-keys

### Variables SEO (Optionnelles)

9. **NEXT_PUBLIC_SITE_URL**
   - Description : URL complète de votre site (pour le SEO)
   - Format : `https://votre-domaine.com`
   - Exemple : `https://promptifyblast.vercel.app`

## Comment Configurer dans Vercel

1. **Accédez à votre projet Vercel**
   - Allez sur https://vercel.com
   - Sélectionnez votre projet `PromptifyBlast`

2. **Ouvrez les paramètres**
   - Cliquez sur **Settings** dans le menu
   - Cliquez sur **Environment Variables** dans le menu latéral

3. **Ajoutez les variables**
   - Cliquez sur **Add New**
   - Entrez le **Name** (ex: `NEXT_PUBLIC_SUPABASE_URL`)
   - Entrez la **Value** (votre valeur)
   - Sélectionnez les **Environments** :
     - ✅ Production
     - ✅ Preview
     - ✅ Development (optionnel)
   - Cliquez sur **Save**

4. **Répétez pour toutes les variables**
   - Ajoutez toutes les variables listées ci-dessus

5. **Redéployez**
   - Après avoir ajouté toutes les variables, allez dans **Deployments**
   - Cliquez sur les **3 points** du dernier déploiement
   - Cliquez sur **Redeploy**
   - Ou poussez un nouveau commit sur GitHub pour déclencher un nouveau déploiement

## Vérification

Après le redéploiement, vérifiez que :
- ✅ L'application se charge sans erreur
- ✅ La connexion/inscription fonctionne
- ✅ La génération de prompts fonctionne
- ✅ Les paiements fonctionnent (si configurés)

## Dépannage

### Erreur : "Missing Supabase environment variables"

**Cause** : Les variables `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` ne sont pas configurées.

**Solution** :
1. Vérifiez que les variables sont bien ajoutées dans Vercel
2. Vérifiez que les noms sont exactement : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (sensible à la casse)
3. Vérifiez que les variables sont activées pour l'environnement Production
4. Redéployez l'application après avoir ajouté les variables

### Les variables ne sont pas prises en compte

**Cause** : Les variables d'environnement ne sont chargées qu'au moment du build.

**Solution** :
- Vous devez **redéployer** l'application après avoir ajouté/modifié des variables
- Les modifications de variables ne sont pas appliquées aux déploiements existants

### Erreur lors du build

**Cause** : Certaines variables peuvent être manquantes ou invalides.

**Solution** :
- Vérifiez les logs de build dans Vercel
- Assurez-vous que toutes les variables requises sont configurées
- Vérifiez que les valeurs sont correctes (pas d'espaces en début/fin)


