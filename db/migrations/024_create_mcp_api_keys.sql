-- 024: AI 비서(MCP) 연결 키
-- PlayMCP 등 외부 AI 비서가 /api/mcp 에 접속할 때 쓰는 사용자별 개인 키.
-- 원문 키는 저장하지 않고 SHA-256 해시만 보관한다. 발급/폐기는 API 라우트(service role)에서만 수행.

CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_user_id ON public.mcp_api_keys(user_id);

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

-- 본인 키 메타데이터만 조회 가능 (INSERT/UPDATE/DELETE 정책 없음 → 클라이언트에서는 변경 불가)
DROP POLICY IF EXISTS "Users can view own mcp keys" ON public.mcp_api_keys;
CREATE POLICY "Users can view own mcp keys"
  ON public.mcp_api_keys FOR SELECT
  USING (user_id = auth.uid());
