-- ============================================================
-- FAIL-SAFE APP — Script SQL Supabase
-- Auteur : Lead Mobile Engineer
-- Description : Schéma de base de données pour la gestion
--               des médicaments et des logs de prise
-- ============================================================

-- Extension pour générer des UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE : medications
-- Stocke les médicaments configurés par l'aidant
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                          -- Nom du médicament (ex: "Doliprane")
  dosage        TEXT NOT NULL,                          -- Dosage (ex: "500mg", "2 comprimés")
  frequency     TEXT NOT NULL CHECK (
                  frequency IN ('daily', 'weekly')
                ),                                      -- Fréquence : quotidien ou hebdomadaire
  specific_days INTEGER[] DEFAULT NULL,                 -- Jours de la semaine (0=Dim, 1=Lun … 6=Sam)
                                                        -- NULL si fréquence = 'daily'
  reminder_time TIME NOT NULL,                          -- Heure du rappel (ex: 08:00:00)
  photo_url     TEXT DEFAULT NULL,                      -- URL de la photo dans Supabase Storage
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,          -- Permet de désactiver sans supprimer
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour accélérer les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_medications_user_id
  ON public.medications(user_id);

-- Index pour les rappels actifs
CREATE INDEX IF NOT EXISTS idx_medications_active
  ON public.medications(user_id, is_active, reminder_time);

-- ============================================================
-- TABLE : intake_logs
-- Journal de chaque prise validée par l'utilisateur
-- ============================================================
CREATE TABLE IF NOT EXISTS public.intake_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id   UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- Timestamp exact de la validation
  scheduled_at    TIMESTAMPTZ DEFAULT NULL,             -- Heure théorique du rappel
  delay_minutes   INTEGER GENERATED ALWAYS AS (
                    EXTRACT(EPOCH FROM (taken_at - scheduled_at)) / 60
                  ) STORED                              -- Retard en minutes (calculé automatiquement)
);

-- Index pour les requêtes de suivi familial
CREATE INDEX IF NOT EXISTS idx_intake_logs_medication
  ON public.intake_logs(medication_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_logs_user
  ON public.intake_logs(user_id, taken_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Chaque utilisateur ne voit QUE ses propres données
-- ============================================================

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_logs ENABLE ROW LEVEL SECURITY;

-- Politique pour medications
CREATE POLICY "Utilisateur accède à ses médicaments"
  ON public.medications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politique pour intake_logs
CREATE POLICY "Utilisateur accède à ses logs"
  ON public.intake_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FONCTION : mise à jour automatique de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BUCKET SUPABASE STORAGE : medication-photos
-- À créer manuellement dans le dashboard Supabase Storage
-- ou via l'API Management :
--   bucket_id = 'medication-photos'
--   public = false (accès via URL signée uniquement)
-- ============================================================

-- ============================================================
-- VUE : résumé des prises pour le suivi familial
-- ============================================================
CREATE OR REPLACE VIEW public.intake_summary AS
  SELECT
    m.user_id,
    m.name          AS medication_name,
    m.dosage,
    m.reminder_time,
    l.taken_at,
    l.scheduled_at,
    l.delay_minutes,
    CASE
      WHEN l.delay_minutes IS NULL THEN 'Non pris'
      WHEN l.delay_minutes <= 30   THEN 'À l''heure'
      WHEN l.delay_minutes <= 120  THEN 'Léger retard'
      ELSE                              'Retard important'
    END AS statut
  FROM public.medications m
  LEFT JOIN public.intake_logs l ON l.medication_id = m.id
  ORDER BY l.taken_at DESC;