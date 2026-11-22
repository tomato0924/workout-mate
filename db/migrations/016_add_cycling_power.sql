-- Add power column for cycling workouts
-- Average power in watts

ALTER TABLE public.workouts
ADD COLUMN IF NOT EXISTS avg_power INTEGER CHECK (avg_power > 0);

-- Add comment for documentation
COMMENT ON COLUMN public.workouts.avg_power IS 'Average power in watts, primarily for cycling';
