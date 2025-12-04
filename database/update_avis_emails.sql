-- Script pour mettre à jour les emails manquants dans la table avis
-- Ce script récupère l'email depuis profiles.email ou auth.users.email
-- et met à jour les avis qui n'ont pas d'email mais ont un user_id

-- Mettre à jour les avis avec user_id mais sans user_email
-- en récupérant l'email depuis profiles.email
UPDATE public.avis a
SET user_email = p.email
FROM public.profiles p
WHERE a.user_id = p.id
  AND a.user_id IS NOT NULL
  AND (a.user_email IS NULL OR a.user_email = '');

-- Si l'email n'est toujours pas dans profiles, essayer depuis auth.users
-- Note: Cette requête nécessite d'être exécutée avec les droits admin
-- car elle accède à auth.users
DO $$
DECLARE
  avis_record RECORD;
  found_email TEXT;
BEGIN
  FOR avis_record IN 
    SELECT a.id, a.user_id 
    FROM public.avis a
    WHERE a.user_id IS NOT NULL 
      AND (a.user_email IS NULL OR a.user_email = '')
  LOOP
    -- Récupérer l'email depuis auth.users
    SELECT email INTO found_email
    FROM auth.users
    WHERE id = avis_record.user_id;
    
    -- Mettre à jour l'avis si on a trouvé un email
    IF found_email IS NOT NULL THEN
      UPDATE public.avis
      SET user_email = found_email
      WHERE id = avis_record.id;
    END IF;
  END LOOP;
END $$;

-- Vérifier le résultat
SELECT 
  id,
  user_id,
  user_email,
  CASE 
    WHEN user_id IS NOT NULL AND (user_email IS NULL OR user_email = '') THEN 'Email manquant'
    ELSE 'OK'
  END as status
FROM public.avis
ORDER BY created_at DESC;

