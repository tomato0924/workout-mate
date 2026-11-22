-- Add active_activity_types to groups table to control which activities are enabled for the crew
-- Default includes all 3 types

ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS active_activity_types TEXT[] DEFAULT ARRAY['running', 'swimming', 'cycling'];

-- Update existing rows to have default value if null
UPDATE public.groups 
SET active_activity_types = ARRAY['running', 'swimming', 'cycling'] 
WHERE active_activity_types IS NULL;
