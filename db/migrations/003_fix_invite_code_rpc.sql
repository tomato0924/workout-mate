-- Function to look up a group by invite code, bypassing RLS
-- This allows users to find a group to join even if they are not yet members

CREATE OR REPLACE FUNCTION public.get_group_by_invite_code(code text)
RETURNS SETOF public.groups
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (admin), bypassing RLS
SET search_path = public
AS $$
BEGIN
  RETURN QUERY 
  SELECT * 
  FROM public.groups 
  WHERE invite_code = code;
END;
$$;
