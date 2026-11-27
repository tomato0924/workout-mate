// 서버 전용: MCP 요청은 Supabase 세션이 없어 RLS가 자동 적용되지 않는다.
// service role 조회 결과는 반드시 이 파일의 규칙(= db/schema/02_rls.sql 의 workouts SELECT 정책)으로 거른다.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CrewRef {
    id: string;
    name: string;
    owner_id: string;
}

/** 내가 속한 크루 목록 */
export async function getMyCrews(admin: SupabaseClient, userId: string): Promise<CrewRef[]> {
    const { data, error } = await admin
        .from('group_members')
        .select('group:groups(id, name, owner_id)')
        .eq('user_id', userId);
    if (error) throw error;
    return (data ?? [])
        .map((r: any) => (Array.isArray(r.group) ? r.group[0] : r.group))
        .filter(Boolean) as CrewRef[];
}

/**
 * RLS와 같은 기준으로 운동 기록 열람 가능 여부를 판단한다.
 * 공개 기록, 본인 기록, 내가 속한 크루에 공유된 기록만 볼 수 있다. (관리자 전체 열람은 MCP에서 쓰지 않음)
 */
export function canSeeWorkout(
    w: { user_id: string; sharing_type: string; shared_group_id?: string | null },
    viewerId: string,
    myCrewIds: string[],
): boolean {
    if (w.user_id === viewerId) return true;
    if (w.sharing_type === 'public') return true;
    if (w.sharing_type === 'group' && w.shared_group_id && myCrewIds.includes(w.shared_group_id)) return true;
    return false;
}

export class ToolInputError extends Error {}

/** 이름 또는 id로 내 크루를 찾는다. 생략하면 크루가 하나일 때만 자동 선택 */
export function resolveCrew(myCrews: CrewRef[], crew?: string): CrewRef {
    if (myCrews.length === 0) throw new ToolInputError('아직 가입한 크루가 없어요. 앱의 크루 메뉴에서 초대 코드로 가입할 수 있어요.');
    const list = myCrews.map(c => `"${c.name}"`).join(', ');
    if (!crew) {
        if (myCrews.length === 1) return myCrews[0];
        throw new ToolInputError(`크루가 여러 개예요. crew에 크루 이름을 지정해 주세요: ${list}`);
    }
    const q = crew.trim().toLowerCase();
    const found =
        myCrews.find(c => c.id === crew.trim()) ??
        myCrews.find(c => c.name.toLowerCase() === q) ??
        myCrews.find(c => c.name.toLowerCase().includes(q));
    if (!found) throw new ToolInputError(`"${crew}" 크루를 찾지 못했어요. 내가 속한 크루: ${list}`);
    return found;
}
