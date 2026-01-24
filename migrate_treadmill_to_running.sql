-- Migrate all treadmill workout records to running
-- This consolidates treadmill and running into a single workout type

-- Step 1: Update all treadmill workouts to running
UPDATE workouts 
SET workout_type = 'running' 
WHERE workout_type = 'treadmill';

-- Step 2: Delete treadmill goals (to avoid duplicate key constraint)
-- Users can manually adjust their running goals if needed
DELETE FROM personal_goals 
WHERE activity_type = 'treadmill';

-- Step 3: Update group goals if they exist
UPDATE group_goals 
SET activity_type = 'running' 
WHERE activity_type = 'treadmill';

-- Verification queries (run these to check the migration)
-- SELECT COUNT(*) FROM workouts WHERE workout_type = 'treadmill'; -- Should return 0
-- SELECT COUNT(*) FROM personal_goals WHERE activity_type = 'treadmill'; -- Should return 0
-- SELECT COUNT(*) FROM group_goals WHERE activity_type = 'treadmill'; -- Should return 0
