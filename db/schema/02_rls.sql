-- Row Level Security Policies for Workout Mate
-- These policies control data access based on user roles and relationships

-- =====================================================
-- 1. USER PROFILES POLICIES
-- =====================================================

-- Users can view only approved users
CREATE POLICY "Users can view approved users"
  ON public.user_profiles FOR SELECT
  USING (approval_status = 'approved' OR id = auth.uid());

-- Users can view their ownprofile even if not approved
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Helper function to prevent recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND approval_status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admins can view all users (Fixed recursion)
CREATE POLICY "Admins can view all users"
  ON public.user_profiles FOR SELECT
  USING (is_admin());

-- Admins can update user approval status and roles (Fixed recursion)
CREATE POLICY "Admins can update users"
  ON public.user_profiles FOR UPDATE
  USING (is_admin());

-- Anyone can insert (for signup)
CREATE POLICY "Anyone can create user profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 2. GROUPS POLICIES
-- =====================================================

-- Users can view approved groups they are members of
CREATE POLICY "Users can view their groups"
  ON public.groups FOR SELECT
  USING (
    approval_status = 'approved' AND (
      id IN (
        SELECT group_id FROM public.group_members
        WHERE user_id = auth.uid()
      ) OR owner_id = auth.uid()
    )
  );

-- Admins can view all groups
CREATE POLICY "Admins can view all groups"
  ON public.groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND approval_status = 'approved'
    )
  );

-- Approved users can create groups
CREATE POLICY "Approved users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
    )
  );

-- Group owners can update their groups
CREATE POLICY "Owners can update groups"
  ON public.groups FOR UPDATE
  USING (owner_id = auth.uid());

-- Admins can update groups (for approval)
CREATE POLICY "Admins can update groups"
  ON public.groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND approval_status = 'approved'
    )
  );

-- =====================================================
-- 3. GROUP MEMBERS POLICIES
-- =====================================================

-- Helper function to prevent recursion in group_members
CREATE OR REPLACE FUNCTION public.get_my_group_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT group_id
  FROM public.group_members
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Members can view members of their groups (Fixed recursion)
CREATE POLICY "Users can view group members"
  ON public.group_members FOR SELECT
  USING (
    group_id IN (SELECT public.get_my_group_ids())
  );

-- Users can join approved groups
CREATE POLICY "Users can join groups"
  ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
    ) AND
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_id
      AND approval_status = 'approved'
    )
  );

-- Users can leave groups
CREATE POLICY "Users can leave groups"
  ON public.group_members FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 4. WORKOUTS POLICIES
-- =====================================================

-- Users can view public workouts
CREATE POLICY "Anyone can view public workouts"
  ON public.workouts FOR SELECT
  USING (sharing_type = 'public');

-- Users can view their own workouts
CREATE POLICY "Users can view own workouts"
  ON public.workouts FOR SELECT
  USING (user_id = auth.uid());

-- Users can view workouts shared with their groups
CREATE POLICY "Users can view group workouts"
  ON public.workouts FOR SELECT
  USING (
    sharing_type = 'group' AND shared_group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    )
  );

-- Admins can view all workouts
CREATE POLICY "Admins can view all workouts"
  ON public.workouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND approval_status = 'approved'
    )
  );

-- Approved users can create workouts
CREATE POLICY "Approved users can create workouts"
  ON public.workouts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
    ) AND user_id = auth.uid()
  );

-- Users can update their own workouts
CREATE POLICY "Users can update own workouts"
  ON public.workouts FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own workouts
CREATE POLICY "Users can delete own workouts"
  ON public.workouts FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 5. WORKOUT IMAGES POLICIES
-- =====================================================

-- Users can view images of workouts they can see
CREATE POLICY "Users can view workout images"
  ON public.workout_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id
      AND (
        w.sharing_type = 'public' OR
        w.user_id = auth.uid() OR
        (w.sharing_type = 'group' AND w.shared_group_id IN (
          SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        ))
      )
    )
  );

-- Users can add images to their own workouts
CREATE POLICY "Users can add workout images"
  ON public.workout_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE id = workout_id
      AND user_id = auth.uid()
    )
  );

-- Users can delete images from their own workouts
CREATE POLICY "Users can delete workout images"
  ON public.workout_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts
      WHERE id = workout_id
      AND user_id = auth.uid()
    )
  );

-- =====================================================
-- 6. GROUP POSTS POLICIES
-- =====================================================

-- Group members can view posts in their groups
CREATE POLICY "Members can view group posts"
  ON public.group_posts FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    )
  );

-- Group members can create posts
CREATE POLICY "Members can create posts"
  ON public.group_posts FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    ) AND user_id = auth.uid()
  );

-- Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON public.group_posts FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts"
  ON public.group_posts FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 7. WORKOUT REACTIONS POLICIES
-- =====================================================

-- Users can view reactions on workouts they can see
CREATE POLICY "Users can view workout reactions"
  ON public.workout_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id
      AND (
        w.sharing_type = 'public' OR
        w.user_id = auth.uid() OR
        (w.sharing_type = 'group' AND w.shared_group_id IN (
          SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        ))
      )
    )
  );

-- Users can add reactions
CREATE POLICY "Users can add reactions"
  ON public.workout_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
  ON public.workout_reactions FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 8. WORKOUT COMMENTS POLICIES
-- =====================================================

-- Users can view comments on workouts they can see
CREATE POLICY "Users can view workout comments"
  ON public.workout_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id
      AND (
        w.sharing_type = 'public' OR
        w.user_id = auth.uid() OR
        (w.sharing_type = 'group' AND w.shared_group_id IN (
          SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        ))
      )
    )
  );

-- Users can add comments
CREATE POLICY "Users can add workout comments"
  ON public.workout_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id
      AND (
        w.sharing_type = 'public' OR
        w.user_id = auth.uid() OR
        (w.sharing_type = 'group' AND w.shared_group_id IN (
          SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        ))
      )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own workout comments"
  ON public.workout_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own workout comments"
  ON public.workout_comments FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 9. POST COMMENTS POLICIES
-- =====================================================

-- Group members can view post comments
CREATE POLICY "Members can view post comments"
  ON public.post_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_posts gp
      JOIN public.group_members gm ON gp.group_id = gm.group_id
      WHERE gp.id = post_id
      AND gm.user_id = auth.uid()
    )
  );

-- Group members can add post comments
CREATE POLICY "Members can add post comments"
  ON public.post_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.group_posts gp
      JOIN public.group_members gm ON gp.group_id = gm.group_id
      WHERE gp.id = post_id
      AND gm.user_id = auth.uid()
    )
  );

-- Users can update their own post comments
CREATE POLICY "Users can update own post comments"
  ON public.post_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own post comments
CREATE POLICY "Users can delete own post comments"
  ON public.post_comments FOR DELETE
  USING (user_id = auth.uid());
