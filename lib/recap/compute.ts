// 연말 결산 / 크루 시상식 집계 로직 (순수 함수, 서버·클라이언트 공용)
import dayjs from 'dayjs';
import type { WorkoutType } from '@/types';

export type RecapWorkout = {
    id: string;
    user_id: string;
    workout_type: WorkoutType;
    workout_date: string; // YYYY-MM-DD
    duration_seconds: number;
    distance_meters: number;
};

export type RecapPerson = {
    id: string;
    nickname: string;
    avatar_url?: string | null;
};

export type TypeStat = { count: number; distance: number; duration: number };

export type PersonalRecap = {
    year: number;
    nickname: string;
    totalCount: number;
    totalDistance: number; // meters
    totalDuration: number; // seconds
    activeDays: number;
    longestStreak: number;
    byType: Partial<Record<WorkoutType, TypeStat>>;
    favoriteType: WorkoutType | null;
    monthly: { month: number; count: number; distance: number }[];
    busiestMonth: { month: number; count: number } | null;
    favoriteWeekday: { weekday: number; count: number } | null;
    longestWorkout: { type: WorkoutType; distance: number; duration: number; date: string } | null;
    bestRunPace: { secondsPerKm: number; distance: number; date: string } | null;
    firstWorkoutDate: string | null;
    reactionsReceived: number;
    commentsReceived: number;
    topSupporters: (RecapPerson & { count: number })[];
    cheersGiven: number;
    competitions: { name: string; date: string; type: string }[];
};

export type Award = {
    key: string;
    emoji: string;
    title: string;
    description: string;
    winners: (RecapPerson & { value: string })[];
};

export type CrewAwards = {
    year: number;
    crewName: string;
    memberCount: number;
    activeMemberCount: number;
    totalCount: number;
    totalDistance: number;
    totalDuration: number;
    byType: Partial<Record<WorkoutType, TypeStat>>;
    awards: Award[];
};

export const TYPE_LABELS: Record<WorkoutType, string> = {
    running: '러닝',
    swimming: '수영',
    cycling: '자전거',
    hiking: '등산',
};

export const TYPE_EMOJI: Record<WorkoutType, string> = {
    running: '🏃',
    swimming: '🏊',
    cycling: '🚴',
    hiking: '🥾',
};

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 1월에는 지난해, 그 외에는 올해를 결산 대상 연도로 본다 */
export function getRecapYear(now = dayjs()): number {
    return now.month() === 0 ? now.year() - 1 : now.year();
}

/** ?year= 쿼리 값 검증. 비어 있으면 기본 결산 연도, 잘못된 값이면 null */
export function parseYearParam(raw: string | null): number | null {
    if (!raw) return getRecapYear();
    const year = Number(raw);
    if (!Number.isInteger(year) || year < 2020 || year > dayjs().year()) return null;
    return year;
}

/** 결산 배너 노출 기간: 12월 1일 ~ 1월 31일 */
export function isRecapSeason(now = dayjs()): boolean {
    return now.month() === 11 || now.month() === 0;
}

export function formatKm(meters: number, digits = 1): string {
    return (meters / 1000).toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatHours(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    if (h === 0) return `${m}분`;
    return m === 0 ? `${h.toLocaleString('ko-KR')}시간` : `${h.toLocaleString('ko-KR')}시간 ${m}분`;
}

export function formatPace(secondsPerKm: number): string {
    const m = Math.floor(secondsPerKm / 60);
    const s = Math.round(secondsPerKm % 60);
    return `${m}'${s.toString().padStart(2, '0')}"`;
}

export function formatTypeDistance(type: WorkoutType, meters: number): string {
    // 수영은 m 단위, 단 10km 이상이면 읽기 쉽게 km로 표시
    if (type === 'swimming' && meters < 10000) return `${Math.round(meters).toLocaleString('ko-KR')}m`;
    return `${formatKm(meters)}km`;
}

/** 총 거리를 실감 나는 비유로 바꿔 준다 */
export function distanceMetaphor(meters: number): string {
    const km = meters / 1000;
    if (km <= 0) return '';
    if (km < 42.195) return `하프 마라톤 ${(km / 21.0975).toFixed(1)}번을 달린 거리예요`;
    if (km < 400) return `풀코스 마라톤 ${(km / 42.195).toFixed(1)}번을 완주한 거리예요`;
    if (km < 3000) return `서울에서 부산까지 ${(km / 400).toFixed(1)}번 간 거리예요`;
    return `서울↔부산을 ${(km / 800).toFixed(1)}번 왕복한 거리예요`;
}

function sumByType(workouts: RecapWorkout[]): Partial<Record<WorkoutType, TypeStat>> {
    const byType: Partial<Record<WorkoutType, TypeStat>> = {};
    for (const w of workouts) {
        const s = (byType[w.workout_type] ??= { count: 0, distance: 0, duration: 0 });
        s.count += 1;
        s.distance += Number(w.distance_meters) || 0;
        s.duration += Number(w.duration_seconds) || 0;
    }
    return byType;
}

/** 운동한 날짜 목록에서 최장 연속 운동일 계산 */
export function longestStreak(dates: string[]): number {
    const unique = [...new Set(dates)].sort();
    let best = 0;
    let cur = 0;
    let prev: dayjs.Dayjs | null = null;
    for (const d of unique) {
        const day = dayjs(d);
        cur = prev && day.diff(prev, 'day') === 1 ? cur + 1 : 1;
        best = Math.max(best, cur);
        prev = day;
    }
    return best;
}

export function computePersonalRecap(params: {
    year: number;
    nickname: string;
    workouts: RecapWorkout[];
    reactionsReceived: { user_id: string }[];
    commentsReceived: { user_id: string }[];
    cheersGiven: number;
    people: Map<string, RecapPerson>;
    competitions: { name: string; date: string; type: string }[];
}): PersonalRecap {
    const { year, nickname, workouts, reactionsReceived, commentsReceived, cheersGiven, people, competitions } = params;

    const byType = sumByType(workouts);
    // 총 거리는 수영 제외 (수영은 m 단위라 따로 보여 줌)
    const totalDistance = workouts.reduce((a, w) => a + (w.workout_type === 'swimming' ? 0 : Number(w.distance_meters) || 0), 0);
    const totalDuration = workouts.reduce((a, w) => a + (Number(w.duration_seconds) || 0), 0);
    const dates = workouts.map(w => w.workout_date);

    const favoriteType = (Object.entries(byType) as [WorkoutType, TypeStat][])
        .sort((a, b) => b[1].count - a[1].count || b[1].duration - a[1].duration)[0]?.[0] ?? null;

    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0, distance: 0 }));
    const weekdays = Array(7).fill(0);
    for (const w of workouts) {
        const d = dayjs(w.workout_date);
        monthly[d.month()].count += 1;
        monthly[d.month()].distance += Number(w.distance_meters) || 0;
        weekdays[d.day()] += 1;
    }
    const busiest = [...monthly].sort((a, b) => b.count - a.count || b.distance - a.distance)[0];
    const busiestMonth = busiest && busiest.count > 0 ? { month: busiest.month, count: busiest.count } : null;
    const maxWeekday = weekdays.reduce((best, c, i) => (c > weekdays[best] ? i : best), 0);
    const favoriteWeekday = weekdays[maxWeekday] > 0 ? { weekday: maxWeekday, count: weekdays[maxWeekday] } : null;

    // 최장 운동: 소요 시간 기준 (종목 간 거리 비교가 공정하지 않으므로)
    const longest = [...workouts].sort((a, b) => b.duration_seconds - a.duration_seconds)[0];
    const longestWorkout = longest
        ? { type: longest.workout_type, distance: longest.distance_meters, duration: longest.duration_seconds, date: longest.workout_date }
        : null;

    // 최고 러닝 페이스: 3km 이상 러닝 중 가장 빠른 기록
    const runs = workouts.filter(w => w.workout_type === 'running' && w.distance_meters >= 3000 && w.duration_seconds > 0);
    const best = runs
        .map(w => ({ secondsPerKm: w.duration_seconds / (w.distance_meters / 1000), distance: w.distance_meters, date: w.workout_date }))
        .filter(r => r.secondsPerKm >= 150) // 2'30"/km 보다 빠르면 입력 오류로 간주
        .sort((a, b) => a.secondsPerKm - b.secondsPerKm)[0];

    const supporterCounts = new Map<string, number>();
    for (const r of [...reactionsReceived, ...commentsReceived]) {
        supporterCounts.set(r.user_id, (supporterCounts.get(r.user_id) ?? 0) + 1);
    }
    const topSupporters = [...supporterCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, count]) => ({ ...(people.get(id) ?? { id, nickname: '알 수 없음' }), count }));

    return {
        year,
        nickname,
        totalCount: workouts.length,
        totalDistance,
        totalDuration,
        activeDays: new Set(dates).size,
        longestStreak: longestStreak(dates),
        byType,
        favoriteType,
        monthly,
        busiestMonth,
        favoriteWeekday,
        longestWorkout,
        bestRunPace: best ?? null,
        firstWorkoutDate: dates.length ? [...dates].sort()[0] : null,
        reactionsReceived: reactionsReceived.length,
        commentsReceived: commentsReceived.length,
        topSupporters,
        cheersGiven,
        competitions: [...competitions].sort((a, b) => a.date.localeCompare(b.date)),
    };
}

/** 값 기준 상위자(동점 포함, 최대 3명) */
function topWinners<T>(
    entries: { person: RecapPerson; value: number; extra?: T }[],
    format: (v: number) => string,
    maxWinners = 3,
): (RecapPerson & { value: string })[] {
    const valid = entries.filter(e => e.value > 0).sort((a, b) => b.value - a.value);
    if (valid.length === 0) return [];
    const topValue = valid[0].value;
    return valid
        .filter(e => e.value === topValue)
        .slice(0, maxWinners)
        .map(e => ({ ...e.person, value: format(e.value) }));
}

export function computeCrewAwards(params: {
    year: number;
    crewName: string;
    members: RecapPerson[];
    workouts: RecapWorkout[];
    cheersGiven: Map<string, number>; // user_id -> 남긴 반응+댓글 수
    competitionCounts: Map<string, number>; // user_id -> 참가 대회 수
}): CrewAwards {
    const { year, crewName, members, workouts, cheersGiven, competitionCounts } = params;

    const byUser = new Map<string, RecapWorkout[]>();
    for (const w of workouts) {
        if (!byUser.has(w.user_id)) byUser.set(w.user_id, []);
        byUser.get(w.user_id)!.push(w);
    }

    const stat = members.map(person => {
        const ws = byUser.get(person.id) ?? [];
        const firstHalf = ws.filter(w => dayjs(w.workout_date).month() < 6);
        const secondHalf = ws.filter(w => dayjs(w.workout_date).month() >= 6);
        return {
            person,
            workouts: ws,
            distance: ws.reduce((a, w) => a + (w.workout_type === 'swimming' ? 0 : w.distance_meters), 0),
            duration: ws.reduce((a, w) => a + w.duration_seconds, 0),
            days: new Set(ws.map(w => w.workout_date)).size,
            streak: longestStreak(ws.map(w => w.workout_date)),
            growth: secondHalf.reduce((a, w) => a + w.duration_seconds, 0) - firstHalf.reduce((a, w) => a + w.duration_seconds, 0),
            byType: sumByType(ws),
        };
    });

    const awards: Award[] = [];
    const push = (a: Omit<Award, 'winners'>, winners: Award['winners']) => {
        if (winners.length > 0) awards.push({ ...a, winners });
    };

    push(
        { key: 'days', emoji: '📅', title: '개근상', description: '운동한 날이 가장 많은 멤버' },
        topWinners(stat.map(s => ({ person: s.person, value: s.days })), v => `${v}일`),
    );
    push(
        { key: 'distance', emoji: '🛣️', title: '최장거리상', description: '러닝·자전거·등산 거리 합계 1위 (수영 제외)' },
        topWinners(stat.map(s => ({ person: s.person, value: s.distance })), v => `${formatKm(v)}km`),
    );
    push(
        { key: 'duration', emoji: '⏱️', title: '땀방울상', description: '운동 시간 합계 1위' },
        topWinners(stat.map(s => ({ person: s.person, value: s.duration })), v => formatHours(v)),
    );
    push(
        { key: 'streak', emoji: '🔥', title: '불꽃 연속상', description: '가장 길게 연속으로 운동한 멤버' },
        topWinners(stat.map(s => ({ person: s.person, value: s.streak >= 2 ? s.streak : 0 })), v => `${v}일 연속`),
    );
    push(
        { key: 'growth', emoji: '📈', title: '성장상', description: '상반기보다 하반기에 운동 시간이 가장 많이 늘어난 멤버' },
        topWinners(stat.map(s => ({ person: s.person, value: s.growth })), v => `+${formatHours(v)}`),
    );
    push(
        { key: 'cheer', emoji: '📣', title: '응원왕', description: '반응과 댓글을 가장 많이 남긴 멤버' },
        topWinners(members.map(p => ({ person: p, value: cheersGiven.get(p.id) ?? 0 })), v => `${v}회`),
    );
    push(
        { key: 'competition', emoji: '🏅', title: '대회왕', description: '대회에 가장 많이 참가한 멤버' },
        topWinners(members.map(p => ({ person: p, value: competitionCounts.get(p.id) ?? 0 })), v => `${v}개 대회`),
    );

    const typeAwards: { type: WorkoutType; title: string }[] = [
        { type: 'running', title: '러닝왕' },
        { type: 'cycling', title: '라이딩왕' },
        { type: 'swimming', title: '물개상' },
        { type: 'hiking', title: '산신령상' },
    ];
    for (const { type, title } of typeAwards) {
        push(
            { key: `type_${type}`, emoji: TYPE_EMOJI[type], title, description: `${TYPE_LABELS[type]} 거리 합계 1위` },
            topWinners(stat.map(s => ({ person: s.person, value: s.byType[type]?.distance ?? 0 })), v => formatTypeDistance(type, v)),
        );
    }

    return {
        year,
        crewName,
        memberCount: members.length,
        activeMemberCount: stat.filter(s => s.workouts.length > 0).length,
        totalCount: workouts.length,
        totalDistance: workouts.reduce((a, w) => a + (w.workout_type === 'swimming' ? 0 : w.distance_meters), 0),
        totalDuration: workouts.reduce((a, w) => a + w.duration_seconds, 0),
        byType: sumByType(workouts),
        awards,
    };
}

/** "토마토님"처럼 이미 '님'으로 끝나는 닉네임에 '님'을 중복으로 붙이지 않는다 */
export function withHonorific(nickname: string): string {
    return nickname.endsWith('님') ? nickname : `${nickname}님`;
}
