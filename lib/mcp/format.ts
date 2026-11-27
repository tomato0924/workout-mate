// MCP 응답용 Markdown 포맷 헬퍼
import type { CompetitionType, WorkoutType } from '@/types';
import { formatWorkoutDistance, formatWorkoutDuration, formatWorkoutMetric } from '@/lib/utils/format';

export const TYPE_LABEL: Record<WorkoutType, string> = {
    running: '러닝',
    swimming: '수영',
    cycling: '사이클',
    hiking: '등산',
};

export const TYPE_ICON: Record<WorkoutType, string> = {
    running: '🏃',
    swimming: '🏊',
    cycling: '🚴',
    hiking: '🥾',
};

// lib/competitions.ts 는 'use client' 모듈이라 서버에서 import하지 않고 따로 둔다
export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
    marathon: '마라톤',
    triathlon: '트라이애슬론',
    granfondo: '그란폰도',
    trail_run: '트레일런',
    other: '기타',
};

export const SHARING_LABEL: Record<string, string> = {
    public: '전체 공개',
    private: '나만 보기',
    group: '크루 공유',
};

/** 표 셀에 들어갈 사용자 입력 문자열 정리 (파이프·줄바꿈 제거) */
export function cell(value: unknown): string {
    return String(value ?? '').replace(/\|/g, '｜').replace(/[\r\n]+/g, ' ').trim();
}

export function table(headers: string[], rows: (string | number)[][]): string {
    const head = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`;
    return [head, ...rows.map(r => `| ${r.map(cell).join(' | ')} |`)].join('\n');
}

export const distance = (meters: number, type: WorkoutType) => formatWorkoutDistance(meters, type);
export const duration = (seconds: number) => formatWorkoutDuration(seconds);

export function paceOrSpeed(meters: number, seconds: number, type: WorkoutType): string {
    const m = formatWorkoutMetric(meters, seconds, type);
    return m.value === '-' ? '-' : `${m.value} (${m.label})`;
}

/** 종목별 합계 거리 표기: 수영은 m, 나머지는 km */
export function totalDistance(meters: number, type: WorkoutType): string {
    return type === 'swimming' ? `${Math.round(meters).toLocaleString('ko-KR')}m` : `${(meters / 1000).toFixed(1)}km`;
}

export function totalDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

// --- 날짜 (한국 시간 기준) ---

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
export function todayKst(): string {
    return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

function shift(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export const addDays = shift;

export type Period = 'week' | 'month' | 'year';

export const PERIOD_LABEL: Record<Period, string> = { week: '이번 주', month: '이번 달', year: '올해' };

/** 이번 주(월요일 시작)/이번 달/올해의 시작일~오늘 */
export function periodRange(period: Period, today = todayKst()): { start: string; end: string } {
    if (period === 'year') return { start: `${today.slice(0, 4)}-01-01`, end: today };
    if (period === 'month') return { start: `${today.slice(0, 7)}-01`, end: today };
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=일
    return { start: shift(today, -((dow + 6) % 7)), end: today };
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
