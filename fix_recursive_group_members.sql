-- =====================================================
-- FIX: INFINITE RECURSION IN GROUP_MEMBERS POLICY
-- =====================================================
-- This script fixes the "infinite recursion detected in policy for relation group_members" error.
-- The error happens because the policy "Users can view group members" queries the `group_members` table
-- to find which groups the user belongs to, while checking permissions on `group_members` itself.

-- 1. Create a secure function to get the current user's group IDs
-- SECURITY DEFINER allows this function to read group_members without triggering the RLS policy recursively.
CREATE OR REPLACE FUNCTION public.get_my_group_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT group_id
  FROM public.group_members
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;

-- 3. Re-create the policy using the secure function
-- Now the policy checks if the row's group_id is in the list returned by our secure function.
CREATE POLICY "Users can view group members"
  ON public.group_members FOR SELECT
  USING (
    group_id IN (SELECT public.get_my_group_ids())
  );
