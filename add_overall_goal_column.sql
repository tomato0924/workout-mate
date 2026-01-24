-- Add overall_goal column to user_profiles table
-- This stores user's comprehensive fitness goal as free text

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS overall_goal TEXT;

-- Update RLS policies are already in place for user_profiles
-- No additional policies needed as users can only update their own profile
