# Dépannage - Envoi d'avis ne fonctionne pas

## Vérifications à faire

### 1. La table existe-t-elle ?
Vérifiez dans Supabase que la table `avis` existe :
- Allez dans Supabase Dashboard → Table Editor
- Vérifiez que la table `avis` est présente

Si elle n'existe pas, exécutez le script SQL dans `avis_table.sql`

### 2. Les politiques RLS sont-elles correctes ?
Vérifiez dans Supabase Dashboard → Authentication → Policies que les politiques suivantes existent :
- `Users can insert own avis` - INSERT - WITH CHECK (true)
- `Users can read own avis` - SELECT - avec la condition appropriée
- `Users can update own avis` - UPDATE - avec auth.uid() = user_id
- `Service role can do everything on avis` - ALL - USING (true) WITH CHECK (true)

### 3. Vérifier les erreurs dans la console
Ouvrez la console du navigateur (F12) et regardez les erreurs :
- Si vous voyez "relation 'avis' does not exist" → La table n'existe pas
- Si vous voyez "permission denied" ou "RLS" → Problème de politiques RLS
- Si vous voyez "PGRST116" → Aucun résultat trouvé (normal si c'est le premier avis)

### 4. Vérifier les logs Supabase
Dans Supabase Dashboard → Logs → Postgres Logs, vérifiez s'il y a des erreurs SQL

### 5. Test simple
Essayez d'insérer directement dans Supabase :
```sql
INSERT INTO public.avis (user_id, user_email, content, tag)
VALUES (NULL, NULL, 'Test', NULL);
```

Si cela fonctionne, le problème vient du code frontend.
Si cela ne fonctionne pas, le problème vient de la configuration Supabase.

## Solutions courantes

### Erreur : "relation 'avis' does not exist"
**Solution** : Exécutez le script SQL `avis_table.sql` dans l'éditeur SQL de Supabase

### Erreur : "permission denied" ou "RLS policy violation"
**Solution** : Vérifiez que les politiques RLS sont correctement créées et que la politique d'insertion permet `WITH CHECK (true)`

### Erreur : "PGRST116" lors de la vérification d'avis existant
**Solution** : C'est normal si c'est le premier avis. Le code a été corrigé pour gérer ce cas.

### L'avis s'envoie mais n'apparaît pas
**Solution** : Vérifiez les politiques de lecture RLS. Les utilisateurs connectés doivent pouvoir lire leurs propres avis.

