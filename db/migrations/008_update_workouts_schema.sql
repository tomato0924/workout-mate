-- Workout Schema Update Migration
-- 1. Clears existing workout data (as requested - PREVIOUS STEP, keeping for history but commenting out if strictly appending, but here I'll just append the new stuff)
-- To be safe, I will just append the new requirements.

-- Add view_count column
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Create RPC function to atomic increment view count
CREATE OR REPLACE FUNCTION increment_workout_view_count(workout_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.workouts
  SET view_count = view_count + 1
  WHERE id = workout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to everyone (or authenticated users)
GRANT EXECUTE ON FUNCTION increment_workout_view_count(uuid) TO public;
GRANT EXECUTE ON FUNCTION increment_workout_view_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_workout_view_count(uuid) TO anon;
