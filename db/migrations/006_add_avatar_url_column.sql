-- Add avatar_url column to user_profiles table
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update types comment if needed (not needed for SQL execution)
