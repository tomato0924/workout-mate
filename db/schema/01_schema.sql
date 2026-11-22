-- Workout Mate Database Schema
-- Complete SQL migration for Supabase

-- =====================================================
-- 1. USER PROFILES TABLE
-- =====================================================
-- Extends Supabase auth.users with additional profile information

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status ON public.user_profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- =====================================================
-- 2. GROUPS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON public.groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON public.groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_groups_approval_status ON public.groups(approval_status);

-- =====================================================
-- 3. GROUP MEMBERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- =====================================================
-- 4. WORKOUTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  workout_type TEXT NOT NULL CHECK (workout_type IN ('running', 'swimming', 'cycling', 'treadmill', 'hiking')),
  workout_date DATE NOT NULL,
  duration_minutes NUMERIC NOT NULL CHECK (duration_minutes > 0),
  distance_km NUMERIC NOT NULL CHECK (distance_km > 0),
  avg_speed_kmh NUMERIC NOT NULL CHECK (avg_speed_kmh > 0),
  avg_heart_rate INTEGER CHECK (avg_heart_rate > 0 AND avg_heart_rate < 300),
  max_heart_rate INTEGER CHECK (max_heart_rate > 0 AND max_heart_rate < 300),
  cadence INTEGER CHECK (cadence > 0), -- for running/treadmill
  swolf INTEGER CHECK (swolf > 0), -- for swimming
  sharing_type TEXT NOT NULL DEFAULT 'private' CHECK (sharing_type IN ('public', 'private', 'group')),
  shared_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON public.workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_workout_date ON public.workouts(workout_date DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_sharing_type ON public.workouts(sharing_type);
CREATE INDEX IF NOT EXISTS idx_workouts_shared_group_id ON public.workouts(shared_group_id);
CREATE INDEX IF NOT EXISTS idx_workouts_created_at ON public.workouts(created_at DESC);

-- =====================================================
-- 5. WORKOUT IMAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.workout_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_images_workout_id ON public.workout_images(workout_id);

-- =====================================================
-- 6. GROUP POSTS TABLE (Bulletin Board)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_posts_group_id ON public.group_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_group_posts_user_id ON public.group_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_group_posts_created_at ON public.group_posts(created_at DESC);

-- =====================================================
-- 7. WORKOUT REACTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.workout_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workout_id, user_id) -- One reaction per user per workout
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_reactions_workout_id ON public.workout_reactions(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_reactions_user_id ON public.workout_reactions(user_id);

-- =====================================================
-- 8. WORKOUT COMMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.workout_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_comments_workout_id ON public.workout_comments(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_comments_user_id ON public.workout_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_comments_created_at ON public.workout_comments(created_at DESC);

-- =====================================================
-- 9. POST COMMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON public.post_comments(created_at DESC);

-- =====================================================
-- 10. TRIGGER: AUTO-APPROVE FIRST USER AS SUPER ADMIN
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_first_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the first user
  IF (SELECT COUNT(*) FROM public.user_profiles) = 0 THEN
    NEW.role := 'super_admin';
    NEW.approval_status := 'approved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_first_user_signup ON public.user_profiles;
CREATE TRIGGER trigger_first_user_signup
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_first_user_signup();

-- =====================================================
-- 11. FUNCTION: AUTO-ADD GROUP OWNER AS MEMBER
-- =====================================================

CREATE OR REPLACE FUNCTION public.add_owner_to_group()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically add the group owner as a member
  INSERT INTO public.group_members (group_id, user_id)
  VALUES (NEW.id, NEW.owner_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_add_owner_to_group ON public.groups;
CREATE TRIGGER trigger_add_owner_to_group
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_to_group();

-- =====================================================
-- Enable Row Level Security on all tables
-- =====================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
