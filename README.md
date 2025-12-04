# 🚀 PromptifyBlast

Générateur de prompts IA optimisés pour ChatGPT, Gemini et Grok. Transformez vos idées en prompts parfaitement structurés en quelques secondes.

## ✨ Fonctionnalités

- ✅ **3 modes de génération** : Basique, Pro, Ultra-Optimisé
- ✅ **Sélection du modèle cible** : ChatGPT, Gemini, Grok (Premium)
- ✅ **Système freemium** : 3 générations gratuites/jour, Premium illimité
- ✅ **Interface moderne** : Dark mode, responsive, intuitive
- ✅ **Optimisations SEO** : Sitemap, robots.txt, métadonnées optimisées
- ✅ **Tests unitaires** : Couverture complète des fonctions utilitaires

## 🛠️ Stack Technique

- **Framework** : Next.js 14 (App Router)
- **Langage** : TypeScript
- **Styling** : TailwindCSS
- **Base de données** : Supabase (PostgreSQL)
- **Authentification** : Supabase Auth
- **Paiements** : Stripe Checkout
- **IA** : Groq API (primary), OpenAI API (fallback)

## 📦 Installation

1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/Kiritogeek/PromptifyBlast.git
   cd PromptifyBlast
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env.local
   ```
   
   Puis remplir `.env.local` avec vos clés :
   - Supabase (URL, Anon Key, Service Role Key)
   - Stripe (Secret Key, Price ID)
   - Groq API Key
   - OpenAI API Key (optionnel)

4. **Configurer Supabase**
   - Créer un projet Supabase
   - Exécuter les scripts SQL dans le dossier `database/`
   - Désactiver la confirmation d'email dans les paramètres

5. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```

6. **Accéder à l'application**
   - Ouvrir http://localhost:3000

## 🧪 Tests

```bash
# Exécuter les tests
npm test

# Tests en mode watch
npm run test:watch

# Tests avec couverture
npm run test:coverage
```

## 📚 Documentation

- [Documentation complète](./DOCUMENTATION_COMPLETE.md)
- [Guide SEO](./README_SEO.md)
- [Guide des tests](./README_TESTS.md)
- [Analyse du code](./CODE_ANALYSIS.md)

## 🚀 Déploiement

### Vercel (Recommandé)

1. Connecter le dépôt GitHub à Vercel
2. Ajouter toutes les variables d'environnement dans Vercel Dashboard
3. Déployer

L'URL sera automatiquement détectée par Vercel (`VERCEL_URL`).

### Netlify

1. Connecter le dépôt GitHub à Netlify
2. Ajouter toutes les variables d'environnement
3. Déployer

L'URL sera automatiquement détectée par Netlify (`DEPLOY_PRIME_URL`).

## 🔐 Variables d'environnement

Voir [.env.example](./.env.example) pour la liste complète des variables nécessaires.

**Important** : Ne jamais commiter `.env.local` dans Git (déjà dans `.gitignore`).

## 📄 Licence

Ce projet est privé. Tous droits réservés.

## 👤 Auteur

**Kiritogeek**

- GitHub: [@Kiritogeek](https://github.com/Kiritogeek)

## 🙏 Remerciements

- Next.js pour le framework
- Supabase pour la base de données et l'authentification
- Stripe pour les paiements
- Groq et OpenAI pour les API IA

