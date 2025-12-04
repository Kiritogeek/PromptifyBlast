-- Table pour stocker les avis des utilisateurs
CREATE TABLE IF NOT EXISTS public.avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  content TEXT NOT NULL CHECK (char_length(content) <= 250),
  tag TEXT CHECK (tag IS NULL OR char_length(tag) <= 15),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_avis_user_id ON public.avis(user_id);
CREATE INDEX IF NOT EXISTS idx_avis_created_at ON public.avis(created_at);
CREATE INDEX IF NOT EXISTS idx_avis_user_email ON public.avis(user_email);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_avis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_avis_updated_at
  BEFORE UPDATE ON public.avis
  FOR EACH ROW
  EXECUTE FUNCTION update_avis_updated_at();

-- Row Level Security (RLS)
ALTER TABLE public.avis ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent créer leurs propres avis
CREATE POLICY "Users can insert own avis"
  ON public.avis FOR INSERT
  WITH CHECK (true); -- Tout le monde peut créer un avis

-- Les utilisateurs peuvent lire leurs propres avis
-- Les utilisateurs connectés peuvent lire leurs avis
-- Les utilisateurs non connectés peuvent lire les avis anonymes
CREATE POLICY "Users can read own avis"
  ON public.avis FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND user_id IS NULL) OR
    user_id IS NULL
  );

-- Les utilisateurs peuvent mettre à jour leurs propres avis
CREATE POLICY "Users can update own avis"
  ON public.avis FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Le service role peut tout faire (bypass RLS pour l'admin)
CREATE POLICY "Service role can do everything on avis"
  ON public.avis FOR ALL
  USING (true) WITH CHECK (true);

-- Contrainte : un utilisateur ne peut avoir qu'un seul tag (mais peut le modifier)
-- Cette contrainte est gérée au niveau applicatif dans le code

