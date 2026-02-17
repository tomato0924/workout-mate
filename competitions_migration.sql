-- =====================================================
-- COMPETITIONS FEATURE - Database Migration
-- =====================================================
-- 올바른 Supabase 프로젝트의 SQL Editor에서 실행하세요.

-- =====================================================
-- 1. COMPETITIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_type TEXT NOT NULL CHECK (competition_type IN ('marathon', 'triathlon', 'granfondo', 'trail_run', 'other')),
  name TEXT NOT NULL,
  abbreviation TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  location TEXT NOT NULL,
  homepage_url TEXT,
  memo TEXT,
  registered_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competitions_start_date ON public.competitions(start_date);
CREATE INDEX IF NOT EXISTS idx_competitions_end_date ON public.competitions(end_date);
CREATE INDEX IF NOT EXISTS idx_competitions_type ON public.competitions(competition_type);
CREATE INDEX IF NOT EXISTS idx_competitions_registered_by ON public.competitions(registered_by);
CREATE INDEX IF NOT EXISTS idx_competitions_created_at ON public.competitions(created_at DESC);

-- =====================================================
-- 2. COMPETITION PARTICIPANTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.competition_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comp_participants_competition_id ON public.competition_participants(competition_id);
CREATE INDEX IF NOT EXISTS idx_comp_participants_user_id ON public.competition_participants(user_id);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_participants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS POLICIES - COMPETITIONS
-- =====================================================

-- All approved users can view all competitions
CREATE POLICY "Approved users can view competitions"
  ON public.competitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
    )
  );

-- Approved users can create competitions
CREATE POLICY "Approved users can create competitions"
  ON public.competitions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
    ) AND registered_by = auth.uid()
  );

-- Creator can update their own competitions
CREATE POLICY "Creator can update own competitions"
  ON public.competitions FOR UPDATE
  USING (registered_by = auth.uid());

-- Admins can update any competition
CREATE POLICY "Admins can update competitions"
  ON public.competitions FOR UPDATE
  USING (is_admin());

-- Creator can delete their own competitions
CREATE POLICY "Creator can delete own competitions"
  ON public.competitions FOR DELETE
  USING (registered_by = auth.uid());

-- Admins can delete any competition
CREATE POLICY "Admins can delete competitions"
  ON public.competitions FOR DELETE
  USING (is_admin());

-- Admins can insert competitions (for bulk import with service role)
CREATE POLICY "Admins can create competitions"
  ON public.competitions FOR INSERT
  WITH CHECK (is_admin());

-- =====================================================
-- 5. RLS POLICIES - COMPETITION PARTICIPANTS
-- =====================================================

-- All approved users can view participants
CREATE POLICY "Approved users can view participants"
  ON public.competition_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
    )
  );

-- Approved users can add themselves as participants
CREATE POLICY "Users can participate in competitions"
  ON public.competition_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
    )
  );

-- Users can remove their own participation
CREATE POLICY "Users can remove own participation"
  ON public.competition_participants FOR DELETE
  USING (user_id = auth.uid());
