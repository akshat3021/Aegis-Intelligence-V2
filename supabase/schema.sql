-- ============================================================
-- AEGIS INTELLIGENCE — Database Reset & Fix
-- Run this in Supabase SQL Editor to fix the schema
-- (Safe to run — drops old incorrect tables and recreates them)
-- ============================================================

-- Step 1: Drop existing tables (in correct dependency order)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.tasks    CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Step 2: Drop any orphaned triggers/functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================
-- Step 3: Recreate tables with correct schema
-- ============================================================

-- ── PROFILES ─────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  objective     TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── MESSAGES ─────────────────────────────────────────────────
CREATE TABLE public.messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id  TEXT NOT NULL DEFAULT 'squish',
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  mood          TEXT DEFAULT 'neutral',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX messages_user_companion_idx
  ON public.messages (user_id, companion_id, created_at);

-- ── TASKS ────────────────────────────────────────────────────
CREATE TABLE public.tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  completed     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX tasks_user_idx
  ON public.tasks (user_id, created_at);

-- ============================================================
-- Step 4: Enable Row Level Security
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks    ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- MESSAGES (user)
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (auth.uid() = user_id);

-- MESSAGES (service role — used by /api/chat backend route)
CREATE POLICY "messages_service_insert" ON public.messages FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "messages_service_select" ON public.messages FOR SELECT TO service_role USING (true);
CREATE POLICY "messages_service_delete" ON public.messages FOR DELETE TO service_role USING (true);

-- TASKS
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Step 5: Auto-create profile on signup trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Done! You should see: "Success. No rows returned"
-- ============================================================
