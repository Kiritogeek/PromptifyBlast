# Configuration de la table Avis

## Création de la table

Pour créer la table `avis` dans Supabase, exécutez le script SQL suivant dans l'éditeur SQL de Supabase :

1. Allez dans votre projet Supabase
2. Ouvrez l'éditeur SQL
3. Copiez-collez le contenu du fichier `avis_table.sql`
4. Exécutez le script

## Structure de la table

La table `avis` contient les colonnes suivantes :
- `id` : UUID (clé primaire)
- `user_id` : UUID (référence vers `auth.users`, nullable pour les avis anonymes)
- `user_email` : TEXT (email de l'utilisateur, nullable)
- `content` : TEXT (contenu de l'avis, max 250 caractères)
- `tag` : TEXT (tag optionnel, 1 maximum par utilisateur)
- `created_at` : TIMESTAMP (date de création)
- `updated_at` : TIMESTAMP (date de mise à jour)

## Contraintes

- Un utilisateur ne peut avoir qu'un seul tag au total (géré au niveau applicatif)
- Le contenu de l'avis est limité à 250 caractères (contrainte SQL)
- Les utilisateurs peuvent créer, lire et mettre à jour leurs propres avis
- L'admin (louisbasnier@gmail.com) peut voir tous les avis via l'API route `/api/avis`

## Permissions (RLS)

- Tout le monde peut créer un avis
- Les utilisateurs peuvent lire et modifier leurs propres avis
- Le service role peut tout faire (pour l'admin)

