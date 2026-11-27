// 서버 전용: Workout Mate MCP 서버 (툴 10개). 요청마다 인증된 사용자로 새로 만든다.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { REACTION_EMOJIS } from '@/lib/utils/constants';
import type { CompetitionType, WorkoutType } from '@/types';
import type { McpUser } from './keys';
import { canSeeWorkout, getMyCrews, resolveCrew, ToolInputError } from './access';
import {
    addDays, cell, COMPETITION_TYPE_LABELS, DATE_RE, distance, duration, paceOrSpeed, Period, PERIOD_LABEL, periodRange,
    SHARING_LABEL, table, todayKst, totalDistance, totalDuration, TYPE_ICON, TYPE_LABEL,
} from './format';

const WORKOUT_TYPES = ['running', 'swimming', 'cycling', 'hiking'] as const;
const COMPETITION_TYPES = ['marathon', 'triathlon', 'granfondo', 'trail_run', 'other'] as const;
const WORKOUT_COLUMNS = 'id, user_id, workout_type, workout_date, duration_seconds, distance_meters, avg_heart_rate, cadence, swolf, avg_power, sharing_type, shared_group_id, created_at';

interface WorkoutRow {
    id: string;
    user_id: string;
    workout_type: WorkoutType;
    workout_date: string;
    duration_seconds: number;
    distance_meters: number;
    avg_heart_rate: number | null;
    cadence: number | null;
    swolf: number | null;
    avg_power: number | null;
    sharing_type: string;
    shared_group_id: string | null;
    created_at: string;
}

const text = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }] });
const fail = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }], isError: true });

async function run(name: string, fn: () => Promise<string>): Promise<CallToolResult> {
    try {
        return text(await fn());
    } catch (e) {
        if (e instanceof ToolInputError) return fail(e.message);
        console.error(`[mcp] ${name} failed:`, e);
        return fail('처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    }
}

/** 닉네임에 '님'을 붙인다. 이미 '님'으로 끝나면 그대로 */
const honorific = (name: string) => (name.endsWith('님') ? name : `${name}님`);

const readOnly = (title: string) => ({ title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });

function sumByType(rows: WorkoutRow[]) {
    const map = new Map<WorkoutType, { count: number; meters: number; seconds: number }>();
    for (const w of rows) {
        const s = map.get(w.workout_type) ?? { count: 0, meters: 0, seconds: 0 };
        s.count += 1;
        s.meters += Number(w.distance_meters) || 0;
        s.seconds += Number(w.duration_seconds) || 0;
        map.set(w.workout_type, s);
    }
    return map;
}

function checkDate(value: string | undefined, field: string): string | undefined {
    if (value === undefined) return undefined;
    if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) throw new ToolInputError(`${field}는 YYYY-MM-DD 형식이어야 해요.`);
    return value;
}

async function nicknames(admin: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data } = await admin.from('user_profiles').select('id, nickname').in('id', ids);
    return new Map((data ?? []).map(p => [p.id, p.nickname]));
}

export function createWorkoutMateServer(user: McpUser, appOrigin: string): McpServer {
    const admin = createAdminClient();
    const server = new McpServer(
        { name: 'workout-mate', title: 'Workout Mate', version: '1.0.0' },
        {
            instructions:
                'Workout Mate(운동 메이트)는 지인끼리 운동 기록을 공유하는 서비스예요. 크루는 함께 운동하는 그룹이에요. ' +
                '응답은 한국어로 하고, 거리는 러닝·사이클·등산은 km, 수영은 m 단위예요. 날짜는 한국 시간 기준이에요.',
        },
    );
    const workoutLink = (id: string) => `${appOrigin}/dashboard/workouts/${id}`;
    const crewLink = (id: string) => `${appOrigin}/dashboard/groups/${id}`;

    // 1. 내 운동 요약
    server.registerTool(
        'get_my_summary',
        {
            title: '내 운동 요약',
            description: '내 운동 기록을 이번 주(월요일 시작)/이번 달/올해 단위로 종목별 횟수·거리·시간을 합산하고, 설정해 둔 개인 목표 달성률을 보여줍니다.',
            inputSchema: {
                period: z.enum(['week', 'month', 'year']).default('week').describe('집계 기간: week(이번 주), month(이번 달), year(올해)'),
            },
            annotations: readOnly('내 운동 요약'),
        },
        async ({ period }) => run('get_my_summary', async () => {
            const p = period as Period;
            const { start, end } = periodRange(p);
            const { data, error } = await admin.from('workouts').select(WORKOUT_COLUMNS)
                .eq('user_id', user.id).gte('workout_date', start).lte('workout_date', end);
            if (error) throw error;
            const rows = (data ?? []) as WorkoutRow[];
            const sums = sumByType(rows);

            const goalPeriod = { week: 'weekly', month: 'monthly', year: 'yearly' }[p];
            const { data: goals } = await admin.from('personal_goals').select('activity_type, target_value, metric_type')
                .eq('user_id', user.id).eq('is_active', true).eq('period_type', goalPeriod).eq('metric_type', 'distance');

            const lines = [`## ${cell(honorific(user.nickname))}의 ${PERIOD_LABEL[p]} 운동 요약 (${start} ~ ${end})`];
            if (rows.length === 0) {
                lines.push('', '이 기간에 기록한 운동이 없어요.');
            } else {
                lines.push('', table(['종목', '횟수', '거리', '시간'],
                    [...sums.entries()].map(([t, s]) => [`${TYPE_ICON[t]} ${TYPE_LABEL[t]}`, `${s.count}회`, totalDistance(s.meters, t), totalDuration(s.seconds)])));
            }
            if (goals && goals.length > 0) {
                lines.push('', '### 개인 목표 달성률');
                for (const g of goals) {
                    const t = g.activity_type as WorkoutType;
                    if (!TYPE_LABEL[t]) continue;
                    const meters = sums.get(t)?.meters ?? 0;
                    const actual = t === 'swimming' ? meters : meters / 1000;
                    const unit = t === 'swimming' ? 'm' : 'km';
                    const pct = g.target_value > 0 ? Math.round((actual / g.target_value) * 100) : 0;
                    lines.push(`- ${TYPE_LABEL[t]}: ${Math.round(actual * 10) / 10}${unit} / ${g.target_value}${unit} (${pct}%)`);
                }
            }
            lines.push('', `[앱에서 보기](${appOrigin}/dashboard)`);
            return lines.join('\n');
        }),
    );

    // 2. 내 운동 기록 목록
    server.registerTool(
        'list_my_workouts',
        {
            title: '내 운동 기록 목록',
            description: '내 운동 기록을 최근 순으로 조회합니다. 기간과 종목으로 거를 수 있고, 페이스(또는 속도)·심박·케이던스·SWOLF·파워를 함께 보여줍니다.',
            inputSchema: {
                start_date: z.string().optional().describe('시작일 YYYY-MM-DD (생략 시 제한 없음)'),
                end_date: z.string().optional().describe('종료일 YYYY-MM-DD (생략 시 오늘)'),
                workout_type: z.enum(WORKOUT_TYPES).optional().describe('종목: running(러닝), swimming(수영), cycling(사이클), hiking(등산)'),
                limit: z.number().int().min(1).max(30).default(10).describe('최대 개수 (1~30)'),
            },
            annotations: readOnly('내 운동 기록 목록'),
        },
        async ({ start_date, end_date, workout_type, limit }) => run('list_my_workouts', async () => {
            const start = checkDate(start_date, 'start_date');
            const end = checkDate(end_date, 'end_date') ?? todayKst();
            let q = admin.from('workouts').select(WORKOUT_COLUMNS).eq('user_id', user.id).lte('workout_date', end);
            if (start) q = q.gte('workout_date', start);
            if (workout_type) q = q.eq('workout_type', workout_type);
            const { data, error } = await q.order('workout_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
            if (error) throw error;
            const rows = (data ?? []) as WorkoutRow[];
            if (rows.length === 0) return '조건에 맞는 운동 기록이 없어요.';

            const body = table(['날짜', '종목', '거리', '시간', '페이스/속도', '기타', '공유', '링크'], rows.map(w => {
                const extra = [
                    w.avg_heart_rate ? `심박 ${w.avg_heart_rate}` : '',
                    w.cadence ? `케이던스 ${w.cadence}` : '',
                    w.swolf ? `SWOLF ${w.swolf}` : '',
                    w.avg_power ? `파워 ${w.avg_power}W` : '',
                ].filter(Boolean).join(', ') || '-';
                return [w.workout_date, `${TYPE_ICON[w.workout_type]} ${TYPE_LABEL[w.workout_type]}`, distance(w.distance_meters, w.workout_type),
                    duration(w.duration_seconds), paceOrSpeed(w.distance_meters, w.duration_seconds, w.workout_type), extra,
                    SHARING_LABEL[w.sharing_type] ?? w.sharing_type, `[보기](${workoutLink(w.id)})`];
            }));
            return `## 내 운동 기록 (${rows.length}건)\n\n${body}`;
        }),
    );

    // 3. 운동 기록 작성
    server.registerTool(
        'log_workout',
        {
            title: '운동 기록 작성',
            description:
                '내 운동 기록을 새로 남깁니다. 기본 공유 범위는 전체 공개(public)이며, 사용자가 원하면 나만 보기(private) 또는 특정 크루 공유(group)로 등록합니다. ' +
                '사진은 앱에서 추가할 수 있습니다. 저장 전에 종목·날짜·거리·시간을 사용자에게 확인받으세요.',
            inputSchema: {
                workout_type: z.enum(WORKOUT_TYPES).describe('종목: running(러닝, 트레드밀 포함), swimming(수영), cycling(사이클), hiking(등산)'),
                distance: z.number().positive().describe('거리. 러닝·사이클·등산은 km, 수영은 m 단위 (예: 10.5km → 10.5, 수영 1500m → 1500)'),
                duration_seconds: z.number().int().positive().describe('운동 시간(초). 예: 52분 30초 → 3150'),
                workout_date: z.string().optional().describe('운동한 날짜 YYYY-MM-DD (생략 시 오늘, 한국 시간)'),
                sharing_type: z.enum(['public', 'private', 'group']).default('public').describe('공유 범위: public(전체 공개, 기본값), private(나만 보기), group(특정 크루에만 공유)'),
                crew: z.string().optional().describe('sharing_type이 group일 때 공유할 크루 이름 또는 id'),
                avg_heart_rate: z.number().int().min(30).max(250).optional().describe('평균 심박수(bpm)'),
                cadence: z.number().int().min(1).max(300).optional().describe('케이던스 (러닝 spm, 사이클 rpm)'),
                swolf: z.number().int().min(1).max(200).optional().describe('SWOLF (수영)'),
                avg_power: z.number().int().min(1).max(2000).optional().describe('평균 파워(W, 사이클)'),
            },
            annotations: { title: '운동 기록 작성', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        async (args) => run('log_workout', async () => {
            const type = args.workout_type as WorkoutType;
            const today = todayKst();
            const date = checkDate(args.workout_date, 'workout_date') ?? today;
            if (date > today) throw new ToolInputError('미래 날짜로는 기록할 수 없어요.');
            if (date < '2000-01-01') throw new ToolInputError('날짜를 다시 확인해 주세요.');

            const meters = type === 'swimming' ? Math.round(args.distance) : Math.round(args.distance * 1000);
            const maxMeters = { running: 300_000, swimming: 30_000, cycling: 1_000_000, hiking: 100_000 }[type];
            if (meters <= 0 || meters > maxMeters) {
                throw new ToolInputError(`거리를 다시 확인해 주세요. ${TYPE_LABEL[type]}는 ${type === 'swimming' ? 'm' : 'km'} 단위예요.`);
            }
            if (args.duration_seconds > 48 * 3600) throw new ToolInputError('운동 시간이 너무 길어요. 초 단위로 입력했는지 확인해 주세요.');

            let sharedGroupId: string | null = null;
            let crewName = '';
            if (args.sharing_type === 'group') {
                const crew = resolveCrew(await getMyCrews(admin, user.id), args.crew);
                sharedGroupId = crew.id;
                crewName = crew.name;
            }

            const { data, error } = await admin.from('workouts').insert({
                user_id: user.id,
                workout_type: type,
                workout_date: date,
                duration_seconds: args.duration_seconds,
                distance_meters: meters,
                avg_heart_rate: args.avg_heart_rate ?? null,
                cadence: type === 'running' || type === 'cycling' ? args.cadence ?? null : null,
                swolf: type === 'swimming' ? args.swolf ?? null : null,
                avg_power: type === 'cycling' ? args.avg_power ?? null : null,
                sharing_type: args.sharing_type,
                shared_group_id: sharedGroupId,
            }).select('id').single();
            if (error) throw error;

            const sharing = args.sharing_type === 'group' ? `크루 "${crewName}"에 공유` : SHARING_LABEL[args.sharing_type];
            return [
                `✅ ${TYPE_ICON[type]} ${TYPE_LABEL[type]} 기록을 저장했어요.`,
                '',
                `- 날짜: ${date}`,
                `- 거리: ${distance(meters, type)}`,
                `- 시간: ${duration(args.duration_seconds)}`,
                `- ${paceOrSpeed(meters, args.duration_seconds, type)}`,
                `- 공유: ${sharing}`,
                '',
                `[기록 보기 · 사진 추가](${workoutLink(data.id)})`,
            ].join('\n');
        }),
    );

    // 4. 내 크루 목록
    server.registerTool(
        'list_my_crews',
        {
            title: '내 크루 목록',
            description: '내가 속한 크루(운동 모임) 목록과 인원, 크루 목표(1인당 주간/월간 거리)를 보여줍니다.',
            inputSchema: {},
            annotations: readOnly('내 크루 목록'),
        },
        async () => run('list_my_crews', async () => {
            const crews = await getMyCrews(admin, user.id);
            if (crews.length === 0) return '아직 가입한 크루가 없어요. 앱의 크루 메뉴에서 초대 코드로 가입할 수 있어요.';
            const ids = crews.map(c => c.id);
            const [{ data: members }, { data: goals }] = await Promise.all([
                admin.from('group_members').select('group_id').in('group_id', ids),
                admin.from('group_goals').select('group_id, activity_type, period_type, target_distance').in('group_id', ids),
            ]);
            const lines = ['## 내 크루'];
            for (const c of crews) {
                const count = (members ?? []).filter(m => m.group_id === c.id).length;
                const g = (goals ?? []).filter(x => x.group_id === c.id).map(x => {
                    const t = x.activity_type as WorkoutType;
                    return `${TYPE_LABEL[t] ?? t} ${x.period_type === 'weekly' ? '주간' : '월간'} ${x.target_distance}${t === 'swimming' ? 'm' : 'km'}`;
                });
                lines.push('', `### ${cell(c.name)}${c.owner_id === user.id ? ' (크루장)' : ''}`,
                    `- 인원: ${count}명`, `- 크루 목표(1인당): ${g.length ? g.join(', ') : '없음'}`, `- [크루 화면](${crewLink(c.id)})`);
            }
            return lines.join('\n');
        }),
    );

    // 크루원들의 (내가 볼 수 있는) 기록 조회
    async function crewWorkouts(crewId: string, myCrewIds: string[], opts: { start?: string; end?: string; type?: string; limit?: number }) {
        const { data: members } = await admin.from('group_members').select('user_id').eq('group_id', crewId);
        const memberIds = (members ?? []).map(m => m.user_id);
        if (memberIds.length === 0) return { memberIds, rows: [] as WorkoutRow[] };
        let q = admin.from('workouts').select(WORKOUT_COLUMNS).in('user_id', memberIds).neq('sharing_type', 'private');
        if (opts.start) q = q.gte('workout_date', opts.start);
        if (opts.end) q = q.lte('workout_date', opts.end);
        if (opts.type) q = q.eq('workout_type', opts.type);
        q = q.order('workout_date', { ascending: false }).order('created_at', { ascending: false });
        const { data, error } = await q.limit(opts.limit ?? 2000);
        if (error) throw error;
        const rows = ((data ?? []) as WorkoutRow[]).filter(w => canSeeWorkout(w, user.id, myCrewIds));
        return { memberIds, rows };
    }

    // 5. 크루 순위
    server.registerTool(
        'get_crew_leaderboard',
        {
            title: '크루 순위',
            description: '크루원들의 이번 주(월요일 시작) 또는 이번 달 종목별 거리 순위와 크루 목표(1인당) 달성률을 보여줍니다. 나만 보기 기록은 집계하지 않습니다.',
            inputSchema: {
                crew: z.string().optional().describe('크루 이름 또는 id (가입한 크루가 하나면 생략 가능)'),
                period: z.enum(['week', 'month']).default('week').describe('기간: week(이번 주), month(이번 달)'),
                workout_type: z.enum(WORKOUT_TYPES).default('running').describe('종목 (기본 running)'),
            },
            annotations: readOnly('크루 순위'),
        },
        async ({ crew, period, workout_type }) => run('get_crew_leaderboard', async () => {
            const myCrews = await getMyCrews(admin, user.id);
            const target = resolveCrew(myCrews, crew);
            const { start, end } = periodRange(period as Period);
            const type = workout_type as WorkoutType;
            const { memberIds, rows } = await crewWorkouts(target.id, myCrews.map(c => c.id), { start, end, type });

            const names = await nicknames(admin, memberIds);
            const stats = new Map(memberIds.map(id => [id, { meters: 0, seconds: 0, count: 0 }]));
            for (const w of rows) {
                const s = stats.get(w.user_id);
                if (!s) continue;
                s.meters += Number(w.distance_meters) || 0;
                s.seconds += Number(w.duration_seconds) || 0;
                s.count += 1;
            }
            const { data: goal } = await admin.from('group_goals').select('target_distance')
                .eq('group_id', target.id).eq('activity_type', type).eq('period_type', period === 'week' ? 'weekly' : 'monthly').maybeSingle();
            const unit = type === 'swimming' ? 'm' : 'km';

            const ranked = [...stats.entries()].sort((a, b) => b[1].meters - a[1].meters);
            const headers = ['순위', '이름', '거리', '시간', '횟수'];
            if (goal) headers.push('목표 달성');
            const body = table(headers, ranked.map(([id, s], i) => {
                const row: (string | number)[] = [
                    s.meters > 0 ? `${i + 1}` : '-',
                    `${names.get(id) ?? '알 수 없음'}${id === user.id ? ' (나)' : ''}`,
                    totalDistance(s.meters, type), s.seconds ? totalDuration(s.seconds) : '-', `${s.count}회`,
                ];
                if (goal) {
                    const actual = type === 'swimming' ? s.meters : s.meters / 1000;
                    row.push(`${Math.round((actual / goal.target_distance) * 100)}%`);
                }
                return row;
            }));
            return [
                `## ${cell(target.name)} ${PERIOD_LABEL[period as Period]} ${TYPE_LABEL[type]} 순위 (${start} ~ ${end})`,
                goal ? `크루 목표: 1인당 ${goal.target_distance}${unit}` : '',
                '',
                body,
                '',
                `[크루 화면](${crewLink(target.id)})`,
            ].filter((l, i) => l !== '' || i > 1).join('\n');
        }),
    );

    // 6. 크루 피드
    server.registerTool(
        'get_crew_feed',
        {
            title: '크루 최근 기록',
            description: '크루원들이 최근 남긴 운동 기록을 보여줍니다. 각 기록의 workout_id는 cheer_workout(응원하기)에 사용합니다.',
            inputSchema: {
                crew: z.string().optional().describe('크루 이름 또는 id (가입한 크루가 하나면 생략 가능)'),
                limit: z.number().int().min(1).max(20).default(10).describe('최대 개수 (1~20)'),
            },
            annotations: readOnly('크루 최근 기록'),
        },
        async ({ crew, limit }) => run('get_crew_feed', async () => {
            const myCrews = await getMyCrews(admin, user.id);
            const target = resolveCrew(myCrews, crew);
            const { rows: all } = await crewWorkouts(target.id, myCrews.map(c => c.id), { start: addDays(todayKst(), -60), limit: 200 });
            const rows = all.slice(0, limit);
            if (rows.length === 0) return `${cell(target.name)} 크루에 최근 60일간 공유된 기록이 없어요.`;

            const ids = rows.map(w => w.id);
            const [names, { data: reactions }, { data: comments }] = await Promise.all([
                nicknames(admin, [...new Set(rows.map(w => w.user_id))]),
                admin.from('workout_reactions').select('workout_id, user_id, emoji').in('workout_id', ids),
                admin.from('workout_comments').select('workout_id').in('workout_id', ids),
            ]);
            const body = table(['날짜', '이름', '종목', '거리', '시간', '반응', '댓글', '내 반응', 'workout_id'], rows.map(w => {
                const rs = (reactions ?? []).filter(r => r.workout_id === w.id);
                const mine = rs.find(r => r.user_id === user.id)?.emoji ?? '-';
                return [w.workout_date, `${names.get(w.user_id) ?? '알 수 없음'}${w.user_id === user.id ? ' (나)' : ''}`,
                    `${TYPE_ICON[w.workout_type]} ${TYPE_LABEL[w.workout_type]}`, distance(w.distance_meters, w.workout_type),
                    duration(w.duration_seconds), rs.map(r => r.emoji).join('') || '-',
                    (comments ?? []).filter(c => c.workout_id === w.id).length, mine, `\`${w.id}\``];
            }));
            return `## ${cell(target.name)} 크루 최근 기록\n\n${body}\n\n[크루 화면](${crewLink(target.id)})`;
        }),
    );

    // 7. 응원하기
    server.registerTool(
        'cheer_workout',
        {
            title: '운동 기록 응원하기',
            description:
                `운동 기록에 이모지 반응이나 응원 댓글을 남깁니다. 기록 작성자에게 앱 알림이 갑니다. workout_id는 get_crew_feed에서 확인하세요. ` +
                `이모지는 ${REACTION_EMOJIS.join(' ')} 중 하나이며, 이미 반응을 남긴 기록이면 이모지가 바뀝니다. 댓글 내용은 사용자에게 확인받은 뒤 남기세요.`,
            inputSchema: {
                workout_id: z.string().uuid().describe('응원할 운동 기록 id'),
                emoji: z.enum(REACTION_EMOJIS as [string, ...string[]]).optional().describe(`반응 이모지: ${REACTION_EMOJIS.join(' ')}`),
                comment: z.string().min(1).max(300).optional().describe('응원 댓글 (300자 이내)'),
            },
            annotations: { title: '운동 기록 응원하기', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        },
        async ({ workout_id, emoji, comment }) => run('cheer_workout', async () => {
            const content = comment?.trim();
            if (!emoji && !content) throw new ToolInputError('emoji 또는 comment 중 하나는 있어야 해요.');
            const { data: w } = await admin.from('workouts').select('id, user_id, sharing_type, shared_group_id').eq('id', workout_id).maybeSingle();
            const myCrewIds = (await getMyCrews(admin, user.id)).map(c => c.id);
            if (!w || !canSeeWorkout(w, user.id, myCrewIds)) throw new ToolInputError('기록을 찾을 수 없어요.');

            const done: string[] = [];
            if (emoji) {
                const { error } = await admin.from('workout_reactions')
                    .upsert({ workout_id, user_id: user.id, emoji }, { onConflict: 'workout_id,user_id' });
                if (error) throw error;
                done.push(`반응 ${emoji}`);
            }
            if (content) {
                const { error } = await admin.from('workout_comments').insert({ workout_id, user_id: user.id, content });
                if (error) throw error;
                done.push(`댓글 "${content}"`);
            }
            const [owner] = (await nicknames(admin, [w.user_id])).values();
            return `💬 ${cell(honorific(owner ?? '작성자'))}의 기록에 ${done.join(', ')}을(를) 남겼어요.\n\n[기록 보기](${workoutLink(workout_id)})`;
        }),
    );

    // 8. 대회 일정 검색
    server.registerTool(
        'search_competitions',
        {
            title: '대회 일정 검색',
            description:
                'Workout Mate에 등록된 마라톤·트라이애슬론·그란폰도·트레일런 대회 일정을 검색합니다. 접수 일정과 참가 예정인 사람, 내 참가 여부를 함께 보여줍니다. ' +
                'competition_id는 join_competition에 사용합니다.',
            inputSchema: {
                start_date: z.string().optional().describe('검색 시작일 YYYY-MM-DD (생략 시 오늘)'),
                end_date: z.string().optional().describe('검색 종료일 YYYY-MM-DD (생략 시 시작일 + 90일)'),
                competition_type: z.enum(COMPETITION_TYPES).optional().describe('대회 종류: marathon, triathlon, granfondo, trail_run, other'),
                keyword: z.string().max(50).optional().describe('대회 이름 또는 장소 검색어'),
                only_joined: z.boolean().default(false).describe('true면 내가 참가 표시한 대회만'),
                limit: z.number().int().min(1).max(20).default(10).describe('최대 개수 (1~20)'),
            },
            annotations: readOnly('대회 일정 검색'),
        },
        async (args) => run('search_competitions', async () => {
            const start = checkDate(args.start_date, 'start_date') ?? todayKst();
            const end = checkDate(args.end_date, 'end_date') ?? addDays(start, 90);
            let q = admin.from('competitions')
                .select('id, name, competition_type, start_date, end_date, start_time, location, homepage_url, participants:competition_participants(user_id), periods:competition_registration_periods(category_name, registration_date, registration_time)')
                .gte('end_date', start).lte('start_date', end);
            if (args.competition_type) q = q.eq('competition_type', args.competition_type);
            const kw = args.keyword?.trim().replace(/[%,()]/g, '');
            if (kw) q = q.or(`name.ilike.%${kw}%,location.ilike.%${kw}%`);
            const { data, error } = await q.order('start_date').limit(args.only_joined ? 200 : args.limit);
            if (error) throw error;
            let comps = (data ?? []) as any[];
            if (args.only_joined) comps = comps.filter(c => c.participants?.some((p: any) => p.user_id === user.id)).slice(0, args.limit);
            if (comps.length === 0) return `${start} ~ ${end} 기간에 조건에 맞는 대회가 없어요.`;

            const names = await nicknames(admin, [...new Set(comps.flatMap(c => (c.participants ?? []).map((p: any) => p.user_id)))] as string[]);
            const lines = [`## 대회 일정 (${start} ~ ${end}, ${comps.length}건)`];
            for (const c of comps) {
                const date = c.start_date === c.end_date ? c.start_date : `${c.start_date} ~ ${c.end_date}`;
                const people = (c.participants ?? []).map((p: any) => names.get(p.user_id)).filter(Boolean);
                const joined = c.participants?.some((p: any) => p.user_id === user.id);
                lines.push('', `### ${cell(c.name)}${joined ? ' ✅ 참가 예정' : ''}`,
                    `- 종류: ${COMPETITION_TYPE_LABELS[c.competition_type as CompetitionType] ?? c.competition_type}`,
                    `- 일시: ${date}${c.start_time ? ` ${String(c.start_time).slice(0, 5)}` : ''}`,
                    `- 장소: ${cell(c.location)}`);
                for (const r of c.periods ?? []) {
                    lines.push(`- 접수(${cell(r.category_name)}): ${r.registration_date}${r.registration_time ? ` ${String(r.registration_time).slice(0, 5)}` : ''}`);
                }
                lines.push(`- 참가 예정: ${people.length ? people.map(cell).join(', ') : '없음'}`);
                if (c.homepage_url) lines.push(`- [대회 홈페이지](${c.homepage_url})`);
                lines.push(`- competition_id: \`${c.id}\``);
            }
            lines.push('', `[대회 일정 화면](${appOrigin}/dashboard/competitions)`);
            return lines.join('\n');
        }),
    );

    // 9. 대회 참가 표시
    server.registerTool(
        'join_competition',
        {
            title: '대회 참가 표시',
            description: '대회에 참가 예정으로 표시하거나(join=true) 참가 표시를 취소합니다(join=false). 실제 대회 접수는 대회 홈페이지에서 따로 해야 합니다.',
            inputSchema: {
                competition_id: z.string().uuid().describe('search_competitions에서 확인한 대회 id'),
                join: z.boolean().default(true).describe('true: 참가 표시, false: 참가 취소'),
            },
            annotations: { title: '대회 참가 표시', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        async ({ competition_id, join }) => run('join_competition', async () => {
            const { data: c } = await admin.from('competitions').select('id, name, start_date').eq('id', competition_id).maybeSingle();
            if (!c) throw new ToolInputError('대회를 찾을 수 없어요.');
            if (join) {
                const { error } = await admin.from('competition_participants')
                    .upsert({ competition_id, user_id: user.id }, { onConflict: 'competition_id,user_id', ignoreDuplicates: true });
                if (error) throw error;
                return `🏁 "${cell(c.name)}"(${c.start_date})에 참가 예정으로 표시했어요. 실제 접수는 대회 홈페이지에서 해 주세요.`;
            }
            const { error } = await admin.from('competition_participants').delete().eq('competition_id', competition_id).eq('user_id', user.id);
            if (error) throw error;
            return `"${cell(c.name)}" 참가 표시를 취소했어요.`;
        }),
    );

    // 10. 공지사항
    server.registerTool(
        'get_announcements',
        {
            title: '운영자 공지사항',
            description: 'Workout Mate 운영자가 올린 최근 공지사항(업데이트 소식 등)을 보여줍니다.',
            inputSchema: {
                limit: z.number().int().min(1).max(10).default(3).describe('최대 개수 (1~10)'),
            },
            annotations: readOnly('운영자 공지사항'),
        },
        async ({ limit }) => run('get_announcements', async () => {
            const { data, error } = await admin.from('announcements').select('title, content, created_at')
                .eq('is_active', true).order('created_at', { ascending: false }).limit(limit);
            if (error) throw error;
            if (!data?.length) return '등록된 공지사항이 없어요.';
            return ['## Workout Mate 공지사항', ...data.map(a =>
                `\n### ${cell(a.title)} (${new Date(new Date(a.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10)})\n\n${a.content}`)].join('\n');
        }),
    );

    return server;
}
