'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconUsers } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { createClient } from '@/lib/supabase/client';
import { RecapAvatar, ShareImageButton } from '@/components/recap/share';
import {
    TYPE_EMOJI,
    TYPE_LABELS,
    WEEKDAY_LABELS,
    distanceMetaphor,
    formatHours,
    formatKm,
    formatPace,
    formatTypeDistance,
    getRecapYear,
    withHonorific,
    type PersonalRecap,
} from '@/lib/recap/compute';
import type { WorkoutType } from '@/types';

type AiComment = { title: string; message: string };

const GRADIENTS = [
    'linear-gradient(160deg, #1b2a6b 0%, #3b2a8f 55%, #7b2ff7 100%)',
    'linear-gradient(160deg, #0f4c75 0%, #1b6ca8 50%, #3fc1c9 100%)',
    'linear-gradient(160deg, #134e5e 0%, #1f8a70 55%, #71b280 100%)',
    'linear-gradient(160deg, #7f1d1d 0%, #c2410c 55%, #f59e0b 100%)',
    'linear-gradient(160deg, #312e81 0%, #6d28d9 50%, #db2777 100%)',
    'linear-gradient(160deg, #0b1d3a 0%, #1e3a8a 50%, #0ea5e9 100%)',
    'linear-gradient(160deg, #3f0d12 0%, #a71d31 55%, #f0a500 100%)',
    'linear-gradient(160deg, #831843 0%, #be185d 50%, #fb7185 100%)',
    'linear-gradient(160deg, #111827 0%, #374151 45%, #b45309 100%)',
];

const SNOW = Array.from({ length: 18 }, (_, i) => ({
    left: (i * 53) % 100,
    top: (i * 37) % 100,
    size: 2 + (i % 4),
    opacity: 0.25 + (i % 5) * 0.1,
}));

function Slide({ index, children }: { index: number; children: ReactNode }) {
    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '9 / 16',
                maxHeight: '78vh',
                borderRadius: 24,
                overflow: 'hidden',
                background: GRADIENTS[index % GRADIENTS.length],
                color: 'white',
                padding: '40px 28px 28px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                wordBreak: 'keep-all',
            }}
        >
            {SNOW.map((s, i) => (
                <span
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${s.left}%`,
                        top: `${s.top}%`,
                        width: s.size,
                        height: s.size,
                        borderRadius: '50%',
                        background: 'white',
                        opacity: s.opacity,
                        pointerEvents: 'none',
                    }}
                />
            ))}
            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
            <div style={{ position: 'relative', fontSize: 12, opacity: 0.7, marginTop: 12 }}>Workout Mate · 운동 메이트</div>
        </div>
    );
}

const Kicker = ({ children }: { children: ReactNode }) => (
    <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.85, marginBottom: 8 }}>{children}</div>
);
const Big = ({ children, size = 56 }: { children: ReactNode; size?: number }) => (
    <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>{children}</div>
);
const Sub = ({ children }: { children: ReactNode }) => (
    <div style={{ fontSize: 17, lineHeight: 1.5, opacity: 0.92, marginTop: 10 }}>{children}</div>
);
const Row = ({ label, value }: { label: ReactNode; value: ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
        <span style={{ fontSize: 16, opacity: 0.9 }}>{label}</span>
        <span style={{ fontSize: 20, fontWeight: 700 }}>{value}</span>
    </div>
);
const Spacer = () => <div style={{ flex: 1 }} />;

function buildSlides(r: PersonalRecap, ai: AiComment | null, aiLoading: boolean): ReactNode[] {
    const year = r.year;
    const slides: ReactNode[] = [];
    const types = (Object.entries(r.byType) as [WorkoutType, NonNullable<PersonalRecap['byType'][WorkoutType]>][])
        .sort((a, b) => b[1].count - a[1].count);

    slides.push(
        <>
            <Spacer />
            <Kicker>{year} 연말 결산</Kicker>
            <Big size={44}>{withHonorific(r.nickname)}의<br />{year}년 운동 이야기</Big>
            <Sub>운동 메이트와 함께한 한 해를<br />함께 돌아볼까요? ❄️</Sub>
            <Spacer />
            <div style={{ fontSize: 14, opacity: 0.8 }}>화면을 넘겨 보세요 →</div>
        </>,
    );

    if (r.totalCount === 0) {
        slides.push(
            <>
                <Spacer />
                <Kicker>올해의 기록</Kicker>
                <Big size={40}>아직 올해 기록이<br />없어요</Big>
                <Sub>괜찮아요! {year + 1}년의 첫 운동을<br />크루와 함께 시작해 봐요 💪</Sub>
                <Spacer />
            </>,
        );
        return slides;
    }

    slides.push(
        <>
            <Kicker>올해 나는</Kicker>
            <Big size={72}>{r.totalCount.toLocaleString('ko-KR')}번</Big>
            <Sub>운동을 기록했어요</Sub>
            <Spacer />
            <Row label="운동한 날" value={`${r.activeDays}일`} />
            <Row label="총 운동 시간" value={formatHours(r.totalDuration)} />
            <Row label="최장 연속 운동" value={`${r.longestStreak}일`} />
            {r.firstWorkoutDate && <Row label="올해 첫 운동" value={dayjs(r.firstWorkoutDate).format('M월 D일')} />}
        </>,
    );

    if (r.totalDistance > 0) {
        slides.push(
            <>
                <Kicker>함께 움직인 거리</Kicker>
                <Big size={64}>{formatKm(r.totalDistance)}<span style={{ fontSize: 28 }}> km</span></Big>
                <Sub>{distanceMetaphor(r.totalDistance)} 🛣️</Sub>
                <Spacer />
                {types.map(([t, s]) => (
                    <Row key={t} label={`${TYPE_EMOJI[t]} ${TYPE_LABELS[t]}`} value={formatTypeDistance(t, s.distance)} />
                ))}
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>* 총 거리는 수영을 제외하고 계산했어요</div>
            </>,
        );
    }

    if (r.favoriteType) {
        const fav = r.byType[r.favoriteType]!;
        slides.push(
            <>
                <Kicker>나의 최애 종목</Kicker>
                <div style={{ fontSize: 96, lineHeight: 1 }}>{TYPE_EMOJI[r.favoriteType]}</div>
                <Big size={52}>{TYPE_LABELS[r.favoriteType]}</Big>
                <Sub>{fav.count}번, {formatHours(fav.duration)} 동안 함께했어요</Sub>
                <Spacer />
                {types.map(([t, s]) => {
                    const pct = Math.round((s.count / r.totalCount) * 100);
                    return (
                        <div key={t} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginBottom: 4 }}>
                                <span>{TYPE_EMOJI[t]} {TYPE_LABELS[t]}</span>
                                <span>{pct}%</span>
                            </div>
                            <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.2)' }}>
                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: 'white' }} />
                            </div>
                        </div>
                    );
                })}
            </>,
        );
    }

    const maxMonth = Math.max(1, ...r.monthly.map(m => m.count));
    slides.push(
        <>
            <Kicker>나의 운동 리듬</Kicker>
            {r.busiestMonth && <Big size={44}>{r.busiestMonth.month}월이<br />가장 뜨거웠어요 🔥</Big>}
            <Sub>
                {r.busiestMonth && <>{r.busiestMonth.month}월에만 {r.busiestMonth.count}번 운동했어요.<br /></>}
                {r.favoriteWeekday && <>가장 자주 운동한 요일은 <b>{WEEKDAY_LABELS[r.favoriteWeekday.weekday]}요일</b></>}
            </Sub>
            <Spacer />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
                {r.monthly.map(m => (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                        <div
                            style={{
                                width: '100%',
                                height: `${(m.count / maxMonth) * 100}%`,
                                minHeight: m.count > 0 ? 4 : 0,
                                borderRadius: 4,
                                background: m.month === r.busiestMonth?.month ? '#fde68a' : 'rgba(255,255,255,0.75)',
                            }}
                        />
                        <span style={{ fontSize: 10, opacity: 0.8 }}>{m.month}</span>
                    </div>
                ))}
            </div>
        </>,
    );

    if (r.longestWorkout || r.bestRunPace) {
        slides.push(
            <>
                <Kicker>올해의 베스트</Kicker>
                <Big size={44}>가장 빛났던<br />순간들 ✨</Big>
                <Spacer />
                {r.longestWorkout && (
                    <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
                        <div style={{ fontSize: 14, opacity: 0.85 }}>가장 오래 운동한 날 · {dayjs(r.longestWorkout.date).format('M월 D일')}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                            {TYPE_EMOJI[r.longestWorkout.type]} {formatHours(r.longestWorkout.duration)}
                        </div>
                        <div style={{ fontSize: 15, opacity: 0.9 }}>
                            {TYPE_LABELS[r.longestWorkout.type]} {formatTypeDistance(r.longestWorkout.type, r.longestWorkout.distance)}
                        </div>
                    </div>
                )}
                {r.bestRunPace && (
                    <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: 16 }}>
                        <div style={{ fontSize: 14, opacity: 0.85 }}>최고 러닝 페이스 · {dayjs(r.bestRunPace.date).format('M월 D일')}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>🏃 {formatPace(r.bestRunPace.secondsPerKm)} /km</div>
                        <div style={{ fontSize: 15, opacity: 0.9 }}>{formatKm(r.bestRunPace.distance, 2)}km 러닝</div>
                    </div>
                )}
            </>,
        );
    }

    if (r.competitions.length > 0) {
        slides.push(
            <>
                <Kicker>올해 도전한 대회</Kicker>
                <Big size={64}>{r.competitions.length}개 🏅</Big>
                <Sub>출발선에 선 것만으로도 멋졌어요</Sub>
                <Spacer />
                {r.competitions.slice(0, 6).map((c, i) => (
                    <Row key={i} label={c.name} value={<span style={{ fontSize: 15 }}>{dayjs(c.date).format('M.D')}</span>} />
                ))}
                {r.competitions.length > 6 && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>외 {r.competitions.length - 6}개</div>}
            </>,
        );
    }

    const received = r.reactionsReceived + r.commentsReceived;
    slides.push(
        <>
            <Kicker>함께라서 더 즐거웠던</Kicker>
            <Big size={56}>응원 {received.toLocaleString('ko-KR')}개 💌</Big>
            <Sub>
                친구들에게 반응 {r.reactionsReceived}개, 댓글 {r.commentsReceived}개를 받았어요.
                <br />나도 {r.cheersGiven}번 응원을 보냈어요.
            </Sub>
            <Spacer />
            {r.topSupporters.length > 0 && (
                <>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>나의 최고 응원단</div>
                    {r.topSupporters.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                            <span style={{ width: 22, fontWeight: 800, fontSize: 18 }}>{i + 1}</span>
                            <RecapAvatar src={p.avatar_url} name={p.nickname} size={40} />
                            <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{p.nickname}</span>
                            <span style={{ fontSize: 15, opacity: 0.9 }}>{p.count}번</span>
                        </div>
                    ))}
                </>
            )}
        </>,
    );

    slides.push(
        <>
            <Kicker>AI 코치가 본 {withHonorific(r.nickname)}의 {year}년</Kicker>
            {aiLoading && !ai ? (
                <Center style={{ flex: 1 }}><Loader color="white" /></Center>
            ) : ai ? (
                <>
                    <Spacer />
                    <div style={{ fontSize: 15, opacity: 0.85 }}>올해의 칭호</div>
                    <Big size={40}>“{ai.title}”</Big>
                    <Sub>{ai.message}</Sub>
                    <Spacer />
                </>
            ) : (
                <>
                    <Spacer />
                    <Big size={36}>{year}년, 정말 수고 많았어요 👏</Big>
                    <Sub>{year + 1}년에도 운동 메이트가 함께할게요!</Sub>
                    <Spacer />
                </>
            )}
        </>,
    );

    slides.push(
        <>
            <Kicker>{year} 운동 결산</Kicker>
            <Big size={36}>{r.nickname}</Big>
            {ai?.title && <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, opacity: 0.95 }}>“{ai.title}”</div>}
            <Spacer />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                    { label: '운동 횟수', value: `${r.totalCount}회` },
                    { label: '운동한 날', value: `${r.activeDays}일` },
                    { label: '총 시간', value: formatHours(r.totalDuration) },
                    { label: '총 거리', value: `${formatKm(r.totalDistance)}km` },
                    { label: '최애 종목', value: r.favoriteType ? `${TYPE_EMOJI[r.favoriteType]} ${TYPE_LABELS[r.favoriteType]}` : '-' },
                    { label: '받은 응원', value: `${received}개` },
                ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, opacity: 0.8 }}>{s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
                    </div>
                ))}
            </div>
            <Spacer />
            <div style={{ fontSize: 15, opacity: 0.9 }}>{year + 1}년에도 함께 달려요 🎉</div>
        </>,
    );

    return slides;
}

export default function YearRecapPage() {
    const year = getRecapYear();
    const [recap, setRecap] = useState<PersonalRecap | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ai, setAi] = useState<AiComment | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [index, setIndex] = useState(0);
    const slideRef = useRef<HTMLDivElement>(null);
    const touchX = useRef<number | null>(null);

    useEffect(() => {
        fetch(`/api/recap?year=${year}`)
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error || '불러오기 실패');
                return res.json();
            })
            .then(setRecap)
            .catch(e => setError(e.message));
    }, [year]);

    // AI 코멘트: 사용자·연도별로 localStorage에 캐시 (Gemini 호출 최소화)
    useEffect(() => {
        if (!recap || recap.totalCount === 0) return;
        let cancelled = false;
        (async () => {
            const { data: { user } } = await createClient().auth.getUser();
            const key = `year_recap_ai_v2_${user?.id}_${year}`;
            try {
                const cached = localStorage.getItem(key);
                if (cached) {
                    setAi(JSON.parse(cached));
                    return;
                }
            } catch { /* localStorage 사용 불가 */ }
            setAiLoading(true);
            try {
                const res = await fetch(`/api/recap/comment?year=${year}`);
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled || !data.title) return;
                setAi(data);
                try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* 무시 */ }
            } finally {
                if (!cancelled) setAiLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [recap, year]);

    const slides = useMemo(() => (recap ? buildSlides(recap, ai, aiLoading) : []), [recap, ai, aiLoading]);
    const total = slides.length;

    const go = useCallback((delta: number) => {
        setIndex(i => Math.min(Math.max(i + delta, 0), Math.max(total - 1, 0)));
    }, [total]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [go]);

    if (error) {
        return <Center h={400}><Text c="red">{error}</Text></Center>;
    }
    if (!recap) {
        return (
            <Center h={400}>
                <Stack align="center">
                    <Loader />
                    <Text c="dimmed">{year}년 기록을 모으는 중이에요…</Text>
                </Stack>
            </Center>
        );
    }

    return (
        <Stack align="center" gap="md" py="md" style={{ maxWidth: 440, margin: '0 auto' }}>
            {/* 진행 표시 */}
            <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                {slides.map((_, i) => (
                    <div
                        key={i}
                        onClick={() => setIndex(i)}
                        style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            cursor: 'pointer',
                            background: i <= index ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-3)',
                        }}
                    />
                ))}
            </div>

            <div
                ref={slideRef}
                style={{ width: '100%', userSelect: 'none', cursor: 'pointer' }}
                onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    go(e.clientX - rect.left < rect.width / 3 ? -1 : 1);
                }}
                onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
                onTouchEnd={e => {
                    if (touchX.current === null) return;
                    const dx = e.changedTouches[0].clientX - touchX.current;
                    touchX.current = null;
                    if (Math.abs(dx) > 40) {
                        e.preventDefault();
                        go(dx < 0 ? 1 : -1);
                    }
                }}
            >
                <Slide index={index}>{slides[index]}</Slide>
            </div>

            <Group justify="space-between" w="100%">
                <Button variant="subtle" leftSection={<IconChevronLeft size={16} />} disabled={index === 0} onClick={() => go(-1)}>
                    이전
                </Button>
                <Text size="sm" c="dimmed">{index + 1} / {total}</Text>
                <Button variant="subtle" rightSection={<IconChevronRight size={16} />} disabled={index === total - 1} onClick={() => go(1)}>
                    다음
                </Button>
            </Group>

            <ShareImageButton
                targetRef={slideRef}
                fileName={`workout-mate-${year}-recap-${index + 1}`}
                title={`${withHonorific(recap.nickname)}의 ${year} 운동 결산`}
                fullWidth
                variant="light"
            />
            <Button component={Link} href="/dashboard/groups" variant="default" fullWidth leftSection={<IconUsers size={16} />}>
                내 크루 시상식 보러 가기
            </Button>
        </Stack>
    );
}
