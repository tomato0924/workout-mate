// 서버 전용: service role 클라이언트로 연말 결산 데이터를 모은다. 클라이언트 컴포넌트에서 import 금지.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
    computeCrewAwards,
    computePersonalRecap,
    type CrewAwards,
    type PersonalRecap,
    type RecapPerson,
    type RecapWorkout,
} from './compute';

const PAGE = 1000;
const IN_CHUNK = 200;

/** Supabase 기본 1000행 제한을 넘는 결과를 페이지 단위로 모두 가져온다 */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
    }
    return rows;
}

/** .in() 인자가 너무 길어지지 않도록 나눠서 조회 */
async function fetchInChunks<T>(ids: string[], build: (chunk: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
    const rows: T[] = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
        const chunk = ids.slice(i, i + IN_CHUNK);
        rows.push(...(await fetchAll<T>((from, to) => build(chunk, from, to))));
    }
    return rows;
}

const yearRange = (year: number) => ({
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    startTs: `${year}-01-01T00:00:00+09:00`,
    endTs: `${year + 1}-01-01T00:00:00+09:00`,
});

const WORKOUT_COLUMNS = 'id, user_id, workout_type, workout_date, duration_seconds, distance_meters';

async function loadPeople(admin: SupabaseClient, ids: string[]): Promise<Map<string, RecapPerson>> {
    const rows = await fetchInChunks<RecapPerson>(ids, (chunk, from, to) =>
        admin.from('user_profiles').select('id, nickname, avatar_url').in('id', chunk).range(from, to),
    );
    return new Map(rows.map(r => [r.id, r]));
}

export async function getPersonalRecap(userId: string, year: number): Promise<PersonalRecap> {
    const admin = createAdminClient();
    const { startDate, endDate, startTs, endTs } = yearRange(year);

    const { data: me } = await admin.from('user_profiles').select('nickname').eq('id', userId).single();

    const workouts = await fetchAll<RecapWorkout>((from, to) =>
        admin.from('workouts').select(WORKOUT_COLUMNS)
            .eq('user_id', userId).gte('workout_date', startDate).lte('workout_date', endDate)
            .order('id').range(from, to),
    );
    const workoutIds = workouts.map(w => w.id);

    // 내 운동에 친구들이 남긴 반응·댓글 (본인 것은 제외)
    const [reactions, comments] = await Promise.all([
        fetchInChunks<{ user_id: string }>(workoutIds, (chunk, from, to) =>
            admin.from('workout_reactions').select('user_id').in('workout_id', chunk).neq('user_id', userId).range(from, to)),
        fetchInChunks<{ user_id: string }>(workoutIds, (chunk, from, to) =>
            admin.from('workout_comments').select('user_id').in('workout_id', chunk).neq('user_id', userId).range(from, to)),
    ]);

    // 내가 올해 남긴 응원 수
    const [{ count: reactionsGiven }, { count: commentsGiven }] = await Promise.all([
        admin.from('workout_reactions').select('id', { count: 'exact', head: true })
            .eq('user_id', userId).gte('created_at', startTs).lt('created_at', endTs),
        admin.from('workout_comments').select('id', { count: 'exact', head: true })
            .eq('user_id', userId).gte('created_at', startTs).lt('created_at', endTs),
    ]);

    // 올해 참가한 대회
    const { data: participations } = await admin
        .from('competition_participants')
        .select('competition:competitions!inner(name, start_date, competition_type)')
        .eq('user_id', userId)
        .gte('competition.start_date', startDate)
        .lte('competition.start_date', endDate);

    const competitions = (participations ?? [])
        .map((p: any) => (Array.isArray(p.competition) ? p.competition[0] : p.competition))
        .filter(Boolean)
        .map((c: any) => ({ name: c.name, date: c.start_date, type: c.competition_type }));

    const supporterIds = [...new Set([...reactions, ...comments].map(r => r.user_id))];
    const people = await loadPeople(admin, supporterIds);

    return computePersonalRecap({
        year,
        nickname: me?.nickname ?? '',
        workouts,
        reactionsReceived: reactions,
        commentsReceived: comments,
        cheersGiven: (reactionsGiven ?? 0) + (commentsGiven ?? 0),
        people,
        competitions,
    });
}

export class NotCrewMemberError extends Error {}

export async function getCrewAwards(userId: string, groupId: string, year: number): Promise<CrewAwards> {
    const admin = createAdminClient();
    const { startDate, endDate, startTs, endTs } = yearRange(year);

    const { data: group } = await admin.from('groups').select('id, name').eq('id', groupId).single();
    const memberRows = await fetchAll<{ user_id: string }>((from, to) =>
        admin.from('group_members').select('user_id').eq('group_id', groupId).range(from, to));
    const memberIds = memberRows.map(m => m.user_id);

    if (!group || !memberIds.includes(userId)) throw new NotCrewMemberError();

    const people = await loadPeople(admin, memberIds);
    const members = memberIds.map(id => people.get(id)).filter((p): p is RecapPerson => !!p);

    // 크루 화면과 같은 기준: 비공개 기록은 집계에서 제외
    const workouts = await fetchInChunks<RecapWorkout>(memberIds, (chunk, from, to) =>
        admin.from('workouts').select(WORKOUT_COLUMNS)
            .in('user_id', chunk).neq('sharing_type', 'private')
            .gte('workout_date', startDate).lte('workout_date', endDate)
            .order('id').range(from, to),
    );

    const [reactions, comments] = await Promise.all([
        fetchInChunks<{ user_id: string }>(memberIds, (chunk, from, to) =>
            admin.from('workout_reactions').select('user_id').in('user_id', chunk)
                .gte('created_at', startTs).lt('created_at', endTs).order('id').range(from, to)),
        fetchInChunks<{ user_id: string }>(memberIds, (chunk, from, to) =>
            admin.from('workout_comments').select('user_id').in('user_id', chunk)
                .gte('created_at', startTs).lt('created_at', endTs).order('id').range(from, to)),
    ]);
    const cheersGiven = new Map<string, number>();
    for (const r of [...reactions, ...comments]) cheersGiven.set(r.user_id, (cheersGiven.get(r.user_id) ?? 0) + 1);

    const participations = await fetchInChunks<{ user_id: string }>(memberIds, (chunk, from, to) =>
        admin.from('competition_participants')
            .select('user_id, competition:competitions!inner(start_date)')
            .in('user_id', chunk)
            .gte('competition.start_date', startDate).lte('competition.start_date', endDate)
            .order('id').range(from, to),
    );
    const competitionCounts = new Map<string, number>();
    for (const p of participations) competitionCounts.set(p.user_id, (competitionCounts.get(p.user_id) ?? 0) + 1);

    return computeCrewAwards({ year, crewName: group.name, members, workouts, cheersGiven, competitionCounts });
}
