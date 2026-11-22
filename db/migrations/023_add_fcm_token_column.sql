-- add_fcm_token_column.sql
-- 푸시 알림을 위해 user_profiles 테이블에 fcm_token 컬럼 추가

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- 주석 추가
COMMENT ON COLUMN public.user_profiles.fcm_token IS 'Firebase Cloud Messaging Device Token for Push Notifications';

-- RLS 정책 업데이트 (본인만 자신의 fcm_token을 수정할 수 있도록 기존 정책으로 충분할 것이나 확인)
