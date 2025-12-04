-- Ajouter la colonne is_admin à la table profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE NOT NULL;

-- Mettre à jour l'utilisateur louisbasnier@gmail.com pour qu'il soit admin
UPDATE public.profiles
SET is_admin = TRUE
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'louisbasnier@gmail.com'
);

-- S'assurer que tous les autres utilisateurs ont is_admin = FALSE
UPDATE public.profiles
SET is_admin = FALSE
WHERE id NOT IN (
  SELECT id FROM auth.users WHERE email = 'louisbasnier@gmail.com'
);

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- Ajouter également la colonne email si elle n'existe pas déjà
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Mettre à jour les emails existants depuis auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Mettre à jour la fonction de création automatique du profil pour inclure l'email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, daily_generations, last_reset, is_premium, unlimited_prompt, is_admin, email)
  VALUES (NEW.id, 0, CURRENT_DATE, FALSE, FALSE, FALSE, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour synchroniser l'email quand il change dans auth.users
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

-- Créer le trigger pour synchroniser l'email
CREATE TRIGGER sync_profile_email_trigger
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_email();

