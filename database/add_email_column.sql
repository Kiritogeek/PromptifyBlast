-- Ajouter la colonne email à la table profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Mettre à jour les emails existants depuis auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Trigger pour mettre à jour automatiquement l'email quand un utilisateur est créé ou modifié
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour l'email dans profiles quand l'email change dans auth.users
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS sync_profile_email_trigger ON auth.users;

-- Créer le trigger
CREATE TRIGGER sync_profile_email_trigger
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_email();

-- Mettre à jour l'email pour tous les profils existants
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

