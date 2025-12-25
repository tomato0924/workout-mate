-- Fix RLS policy to allow joining pending groups
-- The previous policy prevented joining groups that were not yet approved (pending)

DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;

CREATE POLICY "Users can join groups"
  ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
    )
    -- Removed the requirement for the group to be approved
    -- allowing users to join pending groups if they have the invite code
  );
