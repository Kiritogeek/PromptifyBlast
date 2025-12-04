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

