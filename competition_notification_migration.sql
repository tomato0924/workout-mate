-- Competition Notification Support
-- Extend notifications table to support competition-related notifications

-- 1. Make workout_id nullable (was NOT NULL, but competition notifications don't have a workout)
ALTER TABLE public.notifications ALTER COLUMN workout_id DROP NOT NULL;

-- 2. Add competition_id reference
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE;

-- 3. Expand type constraint to include new_competition
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('comment', 'reaction', 'new_competition'));

-- 4. Allow system inserts (for auto-notifying all users about new competitions)
CREATE POLICY "Allow insert for authenticated users" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Trigger: notify all approved users when a new competition is created
CREATE OR REPLACE FUNCTION public.handle_new_competition_notification()
RETURNS TRIGGER AS $$
DECLARE
    target_user RECORD;
BEGIN
    FOR target_user IN
        SELECT id FROM public.user_profiles
        WHERE id != NEW.registered_by
        AND status = 'approved'
    LOOP
        INSERT INTO public.notifications (user_id, actor_id, type, competition_id, content)
        VALUES (
            target_user.id,
            NEW.registered_by,
            'new_competition',
            NEW.id,
            '📢 새 대회: ' || NEW.name || ' (' || TO_CHAR(NEW.start_date, 'YYYY.MM.DD') || ', ' || NEW.location || ')'
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_competition_created ON public.competitions;
CREATE TRIGGER on_competition_created
    AFTER INSERT ON public.competitions
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_competition_notification();
