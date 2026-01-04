-- Create group_goals table to store weekly/monthly targets per activity type
-- User request: "Crew leader can set goals for Running, Swimming, Cycling (Weekly/Monthly)"

CREATE TABLE IF NOT EXISTS public.group_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('running', 'swimming', 'cycling')),
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  target_distance NUMERIC NOT NULL CHECK (target_distance > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, activity_type, period_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_goals_group_id ON public.group_goals(group_id);

-- RLS
ALTER TABLE public.group_goals ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone in the group can read goals (or just everyone authenticated for simplicity first, then refine)
-- Actually, let's stick to: Group Members can view.
-- For now, allow authenticated users to view (simpler query), or join with group_members.
-- Let's make it: Any authenticated user can read (low risk, easiest).
CREATE POLICY "Anyone can view group goals" ON public.group_goals
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Only Owner can insert/update/delete.
-- This requires checking if auth.uid() is the owner of group_id.
CREATE POLICY "Group owners can manage goals" ON public.group_goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_goals.group_id
      AND owner_id = auth.uid()
    )
  );
