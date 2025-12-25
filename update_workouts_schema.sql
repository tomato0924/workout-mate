-- Workout Schema Update Migration
-- 1. Clears existing workout data (as requested)
-- 2. Modifies columns to support new unit requirements

-- Start transaction
BEGIN;

-- 1. Delete all existing workouts (Cascades to linked images, reactions, comments)
DELETE FROM public.workouts;

-- 2. Drop old columns
ALTER TABLE public.workouts DROP COLUMN IF EXISTS duration_minutes;
ALTER TABLE public.workouts DROP COLUMN IF EXISTS distance_km;
ALTER TABLE public.workouts DROP COLUMN IF EXISTS avg_speed_kmh;
ALTER TABLE public.workouts DROP COLUMN IF EXISTS max_heart_rate;

-- 3. Add new columns
-- Duration in seconds (Integer)
ALTER TABLE public.workouts ADD COLUMN duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0);

-- Distance in meters (Integer)
ALTER TABLE public.workouts ADD COLUMN distance_meters INTEGER NOT NULL CHECK (distance_meters > 0);

-- 4. Verify/Recreate index on date (just to be safe, though strict update doesn't touch this)
-- DROP INDEX IF EXISTS idx_workouts_workout_date;
-- CREATE INDEX idx_workouts_workout_date ON public.workouts(workout_date DESC);

COMMIT;

-- Verify changes
-- SELECT * FROM public.workouts LIMIT 1;
