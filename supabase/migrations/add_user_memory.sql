-- ============================================================
-- AEGIS INTELLIGENCE — Add user_memory table
-- Run this in Supabase SQL Editor AFTER the base schema exists.
-- Safe to re-run — uses IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- ── USER_MEMORY ──────────────────────────────────────────────
-- Persistent facts/preferences about a user that companions
-- can reference in conversation. NOT raw chat history.
CREATE TABLE IF NOT EXISTS public.user_memory (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content            TEXT NOT NULL CHECK (char_length(content) <= 500),
  category           TEXT NOT NULL DEFAULT 'general'
                       CHECK (category IN ('preference','goal','fact','topic','habit')),
  relevance_score    SMALLINT NOT NULL DEFAULT 5
                       CHECK (relevance_score BETWEEN 1 AND 10),
  source             TEXT NOT NULL DEFAULT 'manual'
                       CHECK (source IN ('manual','auto','system')),
  last_referenced_at TIMESTAMPTZ DEFAULT now(),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookup: user's most relevant/recent memories
CREATE INDEX IF NOT EXISTS user_memory_user_idx
  ON public.user_memory (user_id, relevance_score DESC, last_referenced_at DESC);

-- ── Hard cap: max 50 memories per user ───────────────────────
-- When a new memory would exceed the limit, auto-prune the
-- oldest + lowest-relevance entry to make room.
CREATE OR REPLACE FUNCTION public.check_memory_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.user_memory WHERE user_id = NEW.user_id) >= 50 THEN
    DELETE FROM public.user_memory
    WHERE id = (
      SELECT id FROM public.user_memory
      WHERE user_id = NEW.user_id
      ORDER BY relevance_score ASC, updated_at ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_memory_limit ON public.user_memory;
CREATE TRIGGER enforce_memory_limit
  BEFORE INSERT ON public.user_memory
  FOR EACH ROW EXECUTE FUNCTION public.check_memory_limit();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

-- Users can CRUD only their own memories
DO $$
BEGIN
  -- Drop existing policies if re-running
  DROP POLICY IF EXISTS "user_memory_select" ON public.user_memory;
  DROP POLICY IF EXISTS "user_memory_insert" ON public.user_memory;
  DROP POLICY IF EXISTS "user_memory_update" ON public.user_memory;
  DROP POLICY IF EXISTS "user_memory_delete" ON public.user_memory;
  DROP POLICY IF EXISTS "user_memory_service_select" ON public.user_memory;
  DROP POLICY IF EXISTS "user_memory_service_insert" ON public.user_memory;
  DROP POLICY IF EXISTS "user_memory_service_update" ON public.user_memory;
  DROP POLICY IF EXISTS "user_memory_service_delete" ON public.user_memory;
END $$;

CREATE POLICY "user_memory_select"
  ON public.user_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_memory_insert"
  ON public.user_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_memory_update"
  ON public.user_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "user_memory_delete"
  ON public.user_memory FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (used by /api/chat backend) — full access
CREATE POLICY "user_memory_service_select"
  ON public.user_memory FOR SELECT
  TO service_role USING (true);

CREATE POLICY "user_memory_service_insert"
  ON public.user_memory FOR INSERT
  TO service_role WITH CHECK (true);

CREATE POLICY "user_memory_service_update"
  ON public.user_memory FOR UPDATE
  TO service_role USING (true);

CREATE POLICY "user_memory_service_delete"
  ON public.user_memory FOR DELETE
  TO service_role USING (true);

-- ============================================================
-- Done! You should see: "Success. No rows returned"
-- ============================================================
