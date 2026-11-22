'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button, Center, Loader, Stack, Text } from '@mantine/core';
import { IconArrowLeft, IconSparkles } from '@tabler/icons-react';
import { RecapAvatar, ShareImageButton } from '@/components/recap/share';
import {
    TYPE_EMOJI,
    TYPE_LABELS,
    formatHours,
    formatKm,
    formatTypeDistance,
    getRecapYear,
    type CrewAwards,
} from '@/lib/recap/compute';
import type { WorkoutType } from '@/types';

export default function CrewAwardsPage() {
    const { id } = useParams<{ id: string }>();
    const year = getRecapYear();
    const [data, setData] = useState<CrewAwards | null>(null);
    const [error, setError] = useState<string | null>(null);
    const posterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch(`/api/groups/${id}/awards?year=${year}`)
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error || '불러오기 실패');
                return res.json();
            })
            .then(setData)
            .catch(e => setError(e.message));
    }, [id, year]);

    if (error) return <Center h={400}><Text c="red">{error}</Text></Center>;
    if (!data) {
        return (
            <Center h={400}>
                <Stack align="center">
                    <Loader />
                    <Text c="dimmed">시상식을 준비하는 중이에요…</Text>
                </Stack>
            </Center>
        );
    }

    const types = (Object.entries(data.byType) as [WorkoutType, NonNullable<CrewAwards['byType'][WorkoutType]>][])
        .sort((a, b) => b[1].count - a[1].count);

    return (
        <Stack gap="md" py="md" style={{ maxWidth: 560, margin: '0 auto' }}>
            <Button component={Link} href={`/dashboard/groups/${id}`} variant="subtle" leftSection={<IconArrowLeft size={16} />} w="fit-content">
                크루로 돌아가기
            </Button>

            <div
                ref={posterRef}
                style={{
                    borderRadius: 24,
                    overflow: 'hidden',
                    color: 'white',
                    background: 'linear-gradient(170deg, #0b1d3a 0%, #312e81 40%, #6d28d9 75%, #b45309 100%)',
                    padding: '32px 20px 24px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                    wordBreak: 'keep-all',
                }}
            >
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.85 }}>🏆 {data.year} 연말 시상식 🏆</div>
                    <div style={{ fontSize: 34, fontWeight: 800, marginTop: 6, lineHeight: 1.2 }}>{data.crewName}</div>
                    <div style={{ fontSize: 15, opacity: 0.85, marginTop: 6 }}>
                        멤버 {data.memberCount}명 중 {data.activeMemberCount}명이 함께 움직였어요
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 20 }}>
                    {[
                        { label: '함께한 운동', value: `${data.totalCount.toLocaleString('ko-KR')}회` },
                        { label: '총 시간', value: formatHours(data.totalDuration) },
                        { label: '총 거리', value: `${formatKm(data.totalDistance, 0)}km` },
                    ].map(s => (
                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>{s.label}</div>
                            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
                        </div>
                    ))}
                </div>
                {types.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12, fontSize: 13, opacity: 0.9 }}>
                        {types.map(([t, s]) => (
                            <span key={t}>{TYPE_EMOJI[t]} {TYPE_LABELS[t]} {formatTypeDistance(t, s.distance)}</span>
                        ))}
                    </div>
                )}

                <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.awards.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 24, opacity: 0.9 }}>
                            올해는 공개된 운동 기록이 없어서 시상할 수 없어요.<br />{data.year + 1}년에는 함께 달려요! 💪
                        </div>
                    )}
                    {data.awards.map(a => (
                        <div key={a.key} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 30 }}>{a.emoji}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 19, fontWeight: 800 }}>{a.title}</div>
                                    <div style={{ fontSize: 13, opacity: 0.8 }}>{a.description}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                                {a.winners.map(w => (
                                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <RecapAvatar src={w.avatar_url} name={w.nickname} size={36} />
                                        <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{w.nickname}</span>
                                        <span style={{ fontSize: 15, fontWeight: 700, color: '#fde68a' }}>{w.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.7, marginTop: 20 }}>
                    Workout Mate · 비공개 기록은 집계에서 제외됩니다
                </div>
            </div>

            <ShareImageButton
                targetRef={posterRef}
                fileName={`workout-mate-${data.year}-crew-awards`}
                title={`${data.crewName} ${data.year} 연말 시상식`}
                fullWidth
                variant="light"
            />
            <Button component={Link} href="/dashboard/recap" variant="default" fullWidth leftSection={<IconSparkles size={16} />}>
                나의 {data.year} 운동 결산 보기
            </Button>
        </Stack>
    );
}
