-- =====================================================
-- FIX: INFINITE RECURSION IN RLS POLICIES
-- =====================================================
-- This script fixes the "infinite recursion detected in policy for relation user_profiles" error.
-- The error happens because the previous admin policy filtered user_profiles by querying user_profiles,
-- causing a loop. We fix this by using a SECURITY DEFINER function that bypasses RLS for the check.

-- 1. Create a secure function to check admin status without triggering RLS recursion
-- SECURITY DEFINER means this function runs with the privileges of the creator (superuser),
-- thus bypassing the RLS on user_profiles while checking permissions.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND approval_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "Admins can view all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update users" ON public.user_profiles;

-- 3. Re-create policies using the secure function
-- Now the policy just calls the function, which internally bypasses RLS safely.

CREATE POLICY "Admins can view all users"
  ON public.user_profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update users"
  ON public.user_profiles FOR UPDATE
  USING (is_admin());
