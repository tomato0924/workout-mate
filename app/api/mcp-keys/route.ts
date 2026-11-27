import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateKey, MAX_ACTIVE_KEYS } from '@/lib/mcp/keys';

export const dynamic = 'force-dynamic';

const KEY_COLUMNS = 'id, user_id, key_prefix, label, created_at, last_used_at, revoked_at';

async function getApprovedUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('approval_status')
        .eq('id', user.id)
        .single();
    return profile?.approval_status === 'approved' ? user : null;
}

/** 내 활성 키 목록 */
export async function GET() {
    const user = await getApprovedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data, error } = await admin
        .from('mcp_api_keys')
        .select(KEY_COLUMNS)
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: '키 목록을 불러오지 못했습니다.' }, { status: 500 });
    return NextResponse.json({ keys: data ?? [] });
}

/** 새 키 발급. 원문 키는 이 응답에서만 내려준다 */
export async function POST(req: NextRequest) {
    const user = await getApprovedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 30) || null : null;

    const admin = createAdminClient();
    const { count } = await admin
        .from('mcp_api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('revoked_at', null);
    if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
        return NextResponse.json(
            { error: `연결 키는 최대 ${MAX_ACTIVE_KEYS}개까지 발급할 수 있어요. 사용하지 않는 키를 먼저 폐기해 주세요.` },
            { status: 400 },
        );
    }

    const { raw, hash, prefix } = generateKey();
    const { data, error } = await admin
        .from('mcp_api_keys')
        .insert({ user_id: user.id, key_hash: hash, key_prefix: prefix, label })
        .select(KEY_COLUMNS)
        .single();
    if (error) return NextResponse.json({ error: '키를 발급하지 못했습니다.' }, { status: 500 });

    return NextResponse.json({ key: data, rawKey: raw });
}

/** 키 폐기 (?id=...) */
export async function DELETE(req: NextRequest) {
    const user = await getApprovedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin
        .from('mcp_api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .select('id');
    if (error) return NextResponse.json({ error: '키를 폐기하지 못했습니다.' }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: '키를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ ok: true });
}
