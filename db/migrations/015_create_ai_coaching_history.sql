-- AI Coaching History Table
-- Stores AI pacemaker coaching results for users

CREATE TABLE IF NOT EXISTS public.ai_coaching_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coaching_content TEXT NOT NULL,
  goal_recommendations JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_coaching_history_user_id ON public.ai_coaching_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_coaching_history_created_at ON public.ai_coaching_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_coaching_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own coaching history"
  ON public.ai_coaching_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coaching history"
  ON public.ai_coaching_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coaching history"
  ON public.ai_coaching_history FOR DELETE
  USING (auth.uid() = user_id);

