// 서버 전용: AI 비서(MCP) 연결 키 생성·검증. 클라이언트 컴포넌트에서 import 금지.
import { createHash, randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const MCP_KEY_HEADER = 'x-workout-mate-key';
export const MAX_ACTIVE_KEYS = 3;
const KEY_PREFIX = 'wm_';

export function hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
}

/** 새 키 원문과 저장용 해시·표시용 접두어를 만든다 */
export function generateKey() {
    const raw = KEY_PREFIX + randomBytes(32).toString('base64url');
    return { raw, hash: hashKey(raw), prefix: raw.slice(0, 10) };
}

export interface McpUser {
    id: string;
    nickname: string;
    keyId: string;
}

/**
 * 요청 헤더의 키로 사용자를 찾는다. 폐기된 키이거나 승인되지 않은 사용자면 null.
 * `Authorization: Bearer wm_...` 형식도 허용한다.
 */
export async function authenticateMcpKey(request: Request): Promise<McpUser | null> {
    let raw = request.headers.get(MCP_KEY_HEADER)?.trim();
    if (!raw) {
        const auth = request.headers.get('authorization');
        if (auth?.toLowerCase().startsWith('bearer ')) raw = auth.slice(7).trim();
    }
    if (!raw || !raw.startsWith(KEY_PREFIX) || raw.length > 200) return null;

    const admin = createAdminClient();
    const { data: key } = await admin
        .from('mcp_api_keys')
        .select('id, user_id, revoked_at, last_used_at')
        .eq('key_hash', hashKey(raw))
        .maybeSingle();
    if (!key || key.revoked_at) return null;

    const { data: profile } = await admin
        .from('user_profiles')
        .select('id, nickname, approval_status')
        .eq('id', key.user_id)
        .single();
    if (!profile || profile.approval_status !== 'approved') return null;

    // 마지막 사용 시각은 1분에 한 번만 갱신 (요청마다 쓰기 방지)
    const last = key.last_used_at ? new Date(key.last_used_at).getTime() : 0;
    if (Date.now() - last > 60_000) {
        await admin.from('mcp_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id);
    }

    return { id: profile.id, nickname: profile.nickname, keyId: key.id };
}

// 키별 간단한 요청 수 제한 (인스턴스 메모리 기준, 분당 60회)
const RATE_LIMIT = 60;
const buckets = new Map<string, { windowStart: number; count: number }>();

export function checkRateLimit(keyId: string): boolean {
    const now = Date.now();
    const b = buckets.get(keyId);
    if (!b || now - b.windowStart > 60_000) {
        buckets.set(keyId, { windowStart: now, count: 1 });
        return true;
    }
    b.count += 1;
    return b.count <= RATE_LIMIT;
}
