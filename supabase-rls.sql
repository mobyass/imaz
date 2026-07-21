-- ════════════════════════════════════════════════════════════
--  ARMAZ – Row Level Security (RLS)
--  Colle ce fichier entier dans Supabase > SQL Editor > Run
-- ════════════════════════════════════════════════════════════

-- ── Activer RLS sur toutes les tables ───────────────────────
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback           ENABLE ROW LEVEL SECURITY;

-- ── Supprimer les anciennes politiques (idempotent) ─────────
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'sessions','user_settings','profiles','workout_templates',
        'session_invitations','session_comments','coaching_requests',
        'progress_photos','feedback'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════
--  SESSIONS
--  - Un utilisateur voit ses propres séances
--  - Un coach voit les séances de ses athlètes (relation acceptée)
-- ════════════════════════════════════════════════════════════
CREATE POLICY "sessions_select" ON sessions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coaching_requests cr
      WHERE cr.status = 'accepted'
        AND (
          (cr.sender_id    = auth.uid() AND cr.recipient_id = sessions.user_id)
          OR
          (cr.recipient_id = auth.uid() AND cr.sender_id    = sessions.user_id)
        )
    )
  );

CREATE POLICY "sessions_insert" ON sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_update" ON sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "sessions_delete" ON sessions FOR DELETE
  USING (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  USER_SETTINGS
-- ════════════════════════════════════════════════════════════
CREATE POLICY "settings_own" ON user_settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  PROFILES
--  - Lecture : tout utilisateur authentifié (search, coaching)
--  - Écriture : propriétaire uniquement
-- ════════════════════════════════════════════════════════════
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  USING (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  WORKOUT_TEMPLATES
-- ════════════════════════════════════════════════════════════
CREATE POLICY "templates_own" ON workout_templates FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  SESSION_INVITATIONS
--  - Expéditeur et destinataire peuvent lire
--  - Seul l'expéditeur peut créer
--  - Seul le destinataire peut accepter/refuser (update status)
-- ════════════════════════════════════════════════════════════
CREATE POLICY "invitations_select" ON session_invitations FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "invitations_insert" ON session_invitations FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "invitations_update" ON session_invitations FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "invitations_delete" ON session_invitations FOR DELETE
  USING (sender_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  SESSION_COMMENTS
--  - Seuls le coach et l'athlète concernés peuvent lire
--  - Seul un coach avec relation acceptée peut créer
--  - Coach et athlète peuvent update (ex: read: true)
--  - Seul le coach peut supprimer
-- ════════════════════════════════════════════════════════════
CREATE POLICY "comments_select" ON session_comments FOR SELECT
  USING (coach_id = auth.uid() OR athlete_id = auth.uid());

CREATE POLICY "comments_insert" ON session_comments FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM coaching_requests cr
      WHERE cr.status = 'accepted'
        AND (
          (cr.sender_id    = auth.uid() AND cr.recipient_id = session_comments.athlete_id)
          OR
          (cr.recipient_id = auth.uid() AND cr.sender_id    = session_comments.athlete_id)
        )
    )
  );

CREATE POLICY "comments_update" ON session_comments FOR UPDATE
  USING (coach_id = auth.uid() OR athlete_id = auth.uid());

CREATE POLICY "comments_delete" ON session_comments FOR DELETE
  USING (coach_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  COACHING_REQUESTS
--  - Expéditeur et destinataire peuvent lire
--  - Seul l'expéditeur peut créer
--  - Seul le destinataire peut accepter/refuser
-- ════════════════════════════════════════════════════════════
CREATE POLICY "coaching_select" ON coaching_requests FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "coaching_insert" ON coaching_requests FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "coaching_update" ON coaching_requests FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "coaching_delete" ON coaching_requests FOR DELETE
  USING (sender_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  PROGRESS_PHOTOS
-- ════════════════════════════════════════════════════════════
CREATE POLICY "photos_own" ON progress_photos FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════
--  FEEDBACK
--  - Insertion uniquement (pas de lecture côté client)
-- ════════════════════════════════════════════════════════════
CREATE POLICY "feedback_insert" ON feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);


-- ════════════════════════════════════════════════════════════
--  STORAGE – Bucket progress_photos
--  (Supabase Storage > Policies > progress_photos)
-- ════════════════════════════════════════════════════════════
-- Décommente et adapte selon le nom exact de ton bucket :
/*
CREATE POLICY "storage_photos_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'progress_photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "storage_photos_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'progress_photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "storage_photos_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'progress_photos' AND auth.uid()::text = (storage.foldername(name))[1]);
*/
