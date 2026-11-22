-- =====================================================
-- COMPETITION COMMENTS & REACTIONS - Database Migration
-- =====================================================

-- 1. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.competition_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_comments_competition_id ON public.competition_comments(competition_id);
CREATE INDEX IF NOT EXISTS idx_comp_comments_user_id ON public.competition_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_comments_created_at ON public.competition_comments(created_at);

ALTER TABLE public.competition_comments ENABLE ROW LEVEL SECURITY;

-- All approved users can view comments
CREATE POLICY "Approved users can view comments"
  ON public.competition_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND approval_status = 'approved'
    )
  );

-- Approved users can create comments
CREATE POLICY "Approved users can create comments"
  ON public.competition_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND approval_status = 'approved'
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON public.competition_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON public.competition_comments FOR DELETE
  USING (user_id = auth.uid());

-- Admins can delete any comment
CREATE POLICY "Admins can delete any comment"
  ON public.competition_comments FOR DELETE
  USING (is_admin());

-- 2. COMMENT REACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.competition_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.competition_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_comp_reactions_comment_id ON public.competition_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comp_reactions_user_id ON public.competition_comment_reactions(user_id);

ALTER TABLE public.competition_comment_reactions ENABLE ROW LEVEL SECURITY;

-- All approved users can view reactions
CREATE POLICY "Approved users can view reactions"
  ON public.competition_comment_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND approval_status = 'approved'
    )
  );

-- Users can add reactions
CREATE POLICY "Users can add reactions"
  ON public.competition_comment_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND approval_status = 'approved'
    )
  );

-- Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
  ON public.competition_comment_reactions FOR DELETE
  USING (user_id = auth.uid());
