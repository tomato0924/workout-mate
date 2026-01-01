
-- Notifications System

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE, -- Receiver
    actor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE, -- Sender (who commented/reacted)
    type TEXT NOT NULL CHECK (type IN ('comment', 'reaction')),
    workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    content TEXT, -- Optional, for comment preview or emoji
    is_read BOOLEAN DEFAULT FALSE NOT NULL
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- 3. RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 4. Triggers for Auto-Notification

-- Trigger Function for Comments
CREATE OR REPLACE FUNCTION public.handle_new_comment()
RETURNS TRIGGER AS $$
BEGIN
    -- Don't notify if commenting on own post
    IF NEW.user_id != (SELECT user_id FROM public.workouts WHERE id = NEW.workout_id) THEN
        INSERT INTO public.notifications (user_id, actor_id, type, workout_id, content)
        VALUES (
            (SELECT user_id FROM public.workouts WHERE id = NEW.workout_id), -- Owner of workout
            NEW.user_id, -- Commenter
            'comment',
            NEW.workout_id,
            substring(NEW.content from 1 for 50) -- Preview
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Function for Reactions
CREATE OR REPLACE FUNCTION public.handle_new_reaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Don't notify if reacting to own post
    IF NEW.user_id != (SELECT user_id FROM public.workouts WHERE id = NEW.workout_id) THEN
        INSERT INTO public.notifications (user_id, actor_id, type, workout_id, content)
        VALUES (
            (SELECT user_id FROM public.workouts WHERE id = NEW.workout_id),
            NEW.user_id,
            'reaction',
            NEW.workout_id,
            NEW.emoji
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Triggers
DROP TRIGGER IF EXISTS on_comment_created ON public.workout_comments;
CREATE TRIGGER on_comment_created
    AFTER INSERT ON public.workout_comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_comment();

DROP TRIGGER IF EXISTS on_reaction_created ON public.workout_reactions;
CREATE TRIGGER on_reaction_created
    AFTER INSERT ON public.workout_reactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_reaction();

-- Function to mark all as read
CREATE OR REPLACE FUNCTION mark_notifications_as_read(target_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = TRUE
    WHERE user_id = target_user_id AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
