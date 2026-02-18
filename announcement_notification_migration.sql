-- Announcement Notification Support
-- Extend notifications table to support announcement notifications

-- 1. Add announcement_id reference
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE;

-- 2. Expand type constraint to include new_announcement
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('comment', 'reaction', 'new_competition', 'new_announcement'));
