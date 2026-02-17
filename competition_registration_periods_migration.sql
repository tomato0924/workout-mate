-- =====================================================
-- COMPETITION REGISTRATION PERIODS - Database Migration
-- =====================================================
-- 대회별 신청일시 (종목, 신청일자, 신청시작시간)를 관리하는 테이블

CREATE TABLE IF NOT EXISTS public.competition_registration_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,        -- 종목명 (예: 풀코스, 하프, 10km)
  registration_date DATE NOT NULL,    -- 신청일자
  registration_time TIME,             -- 신청시작시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comp_reg_periods_competition_id ON public.competition_registration_periods(competition_id);
CREATE INDEX IF NOT EXISTS idx_comp_reg_periods_reg_date ON public.competition_registration_periods(registration_date);

-- Enable RLS
ALTER TABLE public.competition_registration_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All approved users can view registration periods
CREATE POLICY "Approved users can view registration periods"
  ON public.competition_registration_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND approval_status = 'approved'
    )
  );

-- Competition creator can manage registration periods
CREATE POLICY "Creator can insert registration periods"
  ON public.competition_registration_periods FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = competition_id
      AND registered_by = auth.uid()
    )
  );

CREATE POLICY "Creator can update registration periods"
  ON public.competition_registration_periods FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = competition_id
      AND registered_by = auth.uid()
    )
  );

CREATE POLICY "Creator can delete registration periods"
  ON public.competition_registration_periods FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions
      WHERE id = competition_id
      AND registered_by = auth.uid()
    )
  );

-- Admins can manage all registration periods
CREATE POLICY "Admins can insert registration periods"
  ON public.competition_registration_periods FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update registration periods"
  ON public.competition_registration_periods FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete registration periods"
  ON public.competition_registration_periods FOR DELETE
  USING (is_admin());
