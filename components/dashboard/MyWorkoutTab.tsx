
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Title, Stack, Card, Text, Group, Select, SegmentedControl, Grid, Paper, RingProgress, Center, Loader, Button, Image, ActionIcon } from '@mantine/core';
import { IconTrophy, IconRun, IconSwimming, IconBike, IconWalk, IconMountain, IconPlus, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Workout, PersonalGoal } from '@/types';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, RadialBarChart, RadialBar, PolarAngleAxis, LabelList } from 'recharts';

dayjs.extend(isoWeek);

const ACTIVITY_ICONS = {
    running: IconRun,
    swimming: IconSwimming,
    cycling: IconBike,
    treadmill: IconRun, // Fallback
    hiking: IconMountain,
};

const ACTIVITY_LABELS: Record<string, string> = {
    running: '달리기',
    swimming: '수영',
    cycling: '자전거',
    treadmill: '러닝머신',
    hiking: '등산',
};

const PERIOD_LABELS: Record<string, string> = {
    daily: '일간',
    weekly: '주간',
    monthly: '월간',
    yearly: '연간',
};

export function MyWorkoutTab() {
    const router = useRouter();
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [goals, setGoals] = useState<PersonalGoal[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [activityType, setActivityType] = useState<string>('running');
    const [metric, setMetric] = useState<'distance' | 'time'>('distance');
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
    const [dateOffset, setDateOffset] = useState(0);

    // Reset date offset when period changes
    useEffect(() => {
        setDateOffset(0);
    }, [period]);

    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Workouts
            const { data: workoutData } = await supabase
                .from('workouts')
                .select('*')
                .eq('user_id', user.id)
                .order('workout_date', { ascending: true }); // Get all for client-side aggregation

            // Fetch Goals
            const { data: goalData } = await supabase
                .from('personal_goals')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true);

            setWorkouts(workoutData || []);
            setGoals(goalData || []);

            // Smart Default Activity: Set to latest workout type
            if (workoutData && workoutData.length > 0) {
                // Since requested 'ascending: true', the last one is the latest
                const latestWorkout = workoutData[workoutData.length - 1];
                setActivityType(latestWorkout.workout_type);
            }

            setLoading(false);
        };
        fetchData();
    }, []);

    // --- Aggregation Logic ---
    const chartData = useMemo(() => {
        if (!workouts.length) return [];

        // Effective 'Now' based on offset
        let format = 'MM/DD';
        let unit = 'day';
        let count = 5;

        // Configuration based on Period
        switch (period) {
            case 'daily':
                unit = 'day';
                format = 'MM/DD';
                count = 5;
                break;
            case 'weekly':
                unit = 'week';
                format = 'YYYY-W'; // Custom label
                count = 5;
                break;
            case 'monthly':
                unit = 'month';
                format = 'YYYY-MM';
                count = 5;
                break;
            case 'yearly':
                unit = 'year';
                format = 'YYYY';
                count = 5;
                break;
        }

        // Calculate the end date of the visible range
        const endDate = dayjs().subtract(dateOffset * count, unit as any);

        const dataPoints: {
            label: string;
            value: number;
            date: dayjs.Dayjs;
            totalDistance: number;
            totalDuration: number;
            speed: number;
        }[] = [];

        // Generate placeholders for the last 'count' periods
        for (let i = count - 1; i >= 0; i--) {
            const date = endDate.subtract(i, unit as any);
            let label = date.format(format);

            // Custom Week Label
            if (period === 'weekly') {
                const startOfWeek = date.startOf('isoWeek').format('MM/DD');
                const endOfWeek = date.endOf('isoWeek').format('MM/DD');
                label = `${startOfWeek} ~${endOfWeek} `;
            }

            dataPoints.push({
                label,
                value: 0,
                date,
                totalDistance: 0,
                totalDuration: 0,
                speed: 0
            });
        }

        // Aggregate
        workouts.forEach(w => {
            if (activityType !== 'all' && w.workout_type !== activityType) return;

            const wDate = dayjs(w.workout_date);

            // Find matching data point
            const match = dataPoints.find(p => {
                if (period === 'daily') return p.date.isSame(wDate, 'day');
                if (period === 'weekly') return p.date.isSame(wDate, 'isoWeek');
                if (period === 'monthly') return p.date.isSame(wDate, 'month');
                if (period === 'yearly') return p.date.isSame(wDate, 'year');
                return false;
            });

            if (match) {
                match.totalDistance += w.distance_meters;
                match.totalDuration += w.duration_seconds;
            }
        });

        // Compute Final Values & Speed
        return dataPoints.map(p => {
            let value = 0;
            if (metric === 'distance') {
                if (activityType === 'swimming') {
                    value = p.totalDistance; // meters
                } else {
                    value = p.totalDistance / 1000; // km
                }
            } else {
                value = p.totalDuration / 60; // minutes
            }

            // Calculate Speed
            // Default: km/h
            // Swimming: m/min
            let speed = 0;
            if (p.totalDuration > 0) {
                if (activityType === 'swimming') {
                    // m / min
                    speed = p.totalDistance / (p.totalDuration / 60);
                } else {
                    // km / h
                    speed = (p.totalDistance / 1000) / (p.totalDuration / 3600);
                }
            }

            return {
                ...p,
                value: Math.round(value * 10) / 10,
                speed: Math.round(speed * 10) / 10
            };
        });
    }, [workouts, activityType, metric, period, dateOffset]);


    // --- Goal Logic ---
    const goalDashboardData = useMemo(() => {
        const now = dayjs();
        const periods = ['weekly', 'monthly', 'yearly'] as const;

        const aggregatedData = periods.map(p => {
            // Find Goal
            const goal = goals.find(g =>
                g.activity_type === activityType &&
                g.period_type === p &&
                g.metric_type === 'distance' // Always distance for now
            );

            // Calculate Actual
            let actual = 0;
            workouts.forEach(w => {
                if (w.workout_type !== activityType) return;

                const wDate = dayjs(w.workout_date);
                let isMatch = false;

                if (p === 'weekly') isMatch = wDate.isSame(now, 'isoWeek');
                if (p === 'monthly') isMatch = wDate.isSame(now, 'month');
                if (p === 'yearly') isMatch = wDate.isSame(now, 'year');

                if (isMatch) {
                    // Convert to km/m based on activity
                    const val = activityType === 'swimming' ? w.distance_meters : (w.distance_meters / 1000);
                    actual += val;
                }
            });

            return {
                period: p,
                label: PERIOD_LABELS[p],
                target: goal ? goal.target_value : 0,
                actual: Math.round(actual * 10) / 10,
                hasGoal: !!goal && goal.is_active,
                unit: activityType === 'swimming' ? 'm' : 'km'
            };
        });

        const weeklyData = aggregatedData.find(d => d.period === 'weekly')!;
        const monthlyData = aggregatedData.find(d => d.period === 'monthly')!;
        const yearlyData = aggregatedData.find(d => d.period === 'yearly')!;

        const chartData = [
            {
                name: '연간',
                period: 'yearly',
                label: '연간',
                uv: 100,
                pv: Math.min(100, Math.round((yearlyData.actual / yearlyData.target) * 100)) || 0,
                fill: '#fab005', // Yellow
                target: yearlyData.target,
                actual: yearlyData.actual,
                unit: yearlyData.unit
            },
            {
                name: '월간',
                period: 'monthly',
                label: '월간',
                uv: 100,
                pv: Math.min(100, Math.round((monthlyData.actual / monthlyData.target) * 100)) || 0,
                fill: '#12b886', // Teal
                target: monthlyData.target,
                actual: monthlyData.actual,
                unit: monthlyData.unit
            },
            {
                name: '주간',
                period: 'weekly',
                label: '주간',
                uv: 100, // Background ring (always 100%)
                pv: Math.min(100, Math.round((weeklyData.actual / weeklyData.target) * 100)) || 0,
                fill: '#228be6', // Blue
                target: weeklyData.target,
                actual: weeklyData.actual,
                unit: weeklyData.unit
            }
        ];

        return chartData;
    }, [goals, workouts, activityType]);

    const unitLabel = metric === 'time' ? '분' : (activityType === 'swimming' ? 'm' : 'km');

    if (loading) {
        return (
            <Center h={300}>
                <Loader />
            </Center>
        );
    }

    return (
        <Stack mt="md" gap="xl">
            {/* Global Activity Selector */}
            <Paper p="md" withBorder radius="md">
                <Group justify="space-between" align="start">
                    <Stack gap="xs" style={{ flex: 1 }}>
                        <Text fw={500} size="sm" c="dimmed">운동 종목 선택</Text>
                        <Select
                            value={activityType}
                            onChange={(v) => v && setActivityType(v)}
                            data={[
                                { label: '달리기', value: 'running' },
                                { label: '수영', value: 'swimming' },
                                { label: '자전거', value: 'cycling' },
                                { label: '러닝머신', value: 'treadmill' },
                                { label: '등산', value: 'hiking' },
                            ]}
                            allowDeselect={false}
                        />
                    </Stack>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={() => router.push(`/dashboard/workouts/new?type=${activityType}`)}
                        variant="filled"
                        color="blue"
                        mt={26}
                    >
                        운동 기록
                    </Button>
                </Group>
            </Paper>

            {/* Chart 1: History */}
            <Card withBorder radius="md" p="md">
                <Group justify="space-between" mb="lg">
                    <Group align="center" gap="xs">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => setDateOffset(prev => prev + 1)}
                        >
                            <IconChevronLeft size={20} />
                        </ActionIcon>
                        <Title order={4}>
                            {ACTIVITY_LABELS[activityType]} 기록 추이
                        </Title>
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => setDateOffset(prev => prev - 1)}
                            disabled={dateOffset <= 0}
                        >
                            <IconChevronRight size={20} />
                        </ActionIcon>
                    </Group>
                    <Group>
                        <Select
                            value={metric}
                            onChange={(v) => setMetric(v as any)}
                            data={[
                                { label: '거리', value: 'distance' },
                                { label: '시간', value: 'time' },
                            ]}
                            w={100}
                        />
                        <Select
                            value={period}
                            onChange={(v) => setPeriod(v as any)}
                            data={[
                                { label: '일간', value: 'daily' },
                                { label: '주간', value: 'weekly' },
                                { label: '월간', value: 'monthly' },
                                { label: '연간', value: 'yearly' },
                            ]}
                            w={100}
                        />
                    </Group>
                </Group>

                <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" fontSize={12} tickMargin={10} />
                            {/* Left Axis: Hidden */}
                            <YAxis hide yAxisId="left" />
                            {/* Right Axis: For Speed, Hidden */}
                            <YAxis hide yAxisId="right" orientation="right" />

                            <Bar yAxisId="left" dataKey="value" fill="#228be6" radius={[4, 4, 0, 0]}>
                                <LabelList
                                    dataKey="value"
                                    position="top"
                                    formatter={(value: any) => value > 0 ? `${value}${unitLabel}` : ''}
                                    style={{ fontSize: 12, fill: '#666' }}
                                />
                                <Cell fill="#228be6" />
                            </Bar>

                            {/* Speed Overlay Line */}
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="speed"
                                stroke="#ff6b6b"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                            >
                                <LabelList
                                    dataKey="speed"
                                    position="top"
                                    offset={10}
                                    formatter={(value: any) => value > 0 ? `${value}${activityType === 'swimming' ? 'm/m' : 'km/h'}` : ''}
                                    style={{ fontSize: 10, fill: '#ff6b6b', fontWeight: 500 }}
                                />
                            </Line>
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Chart 2: Goal Dashboard (Concentric Rings) */}
            <Stack gap="md">
                <Group justify="space-between">
                    <Title order={4}> 목표 달성 현황</Title>
                    <IconTrophy size={20} color="gold" />
                </Group>

                <Card withBorder radius="md" p="md">
                    <Group justify="space-around" align="center" wrap="nowrap">
                        <div style={{ width: '100%', maxWidth: 300, height: 300, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadialBarChart
                                    innerRadius="30%"
                                    outerRadius="100%"
                                    data={goalDashboardData}
                                    startAngle={90}
                                    endAngle={-270}
                                    barSize={20}
                                >
                                    <PolarAngleAxis
                                        type="number"
                                        domain={[0, 100]}
                                        angleAxisId={0}
                                        tick={false}
                                    />
                                    <RadialBar
                                        background
                                        dataKey="pv"
                                        cornerRadius={10}
                                        label={false}
                                    />
                                    {/* Tooltip removed as per request */}
                                </RadialBarChart >
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 60,
                                    height: 60,
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    zIndex: 0,
                                    opacity: 0.8
                                }}>
                                    <Image
                                        src={`/images/workout-types/${activityType}.jpg`}
                                        alt={activityType}
                                        w="100%"
                                        h="100%"
                                        fit="cover"
                                        fallbackSrc="https://placehold.co/60x60?text=Icon"
                                    />
                                </div>
                            </ResponsiveContainer >
                        </div >
                    </Group >

                    {/* Custom Legend */}
                    < Stack mt="md" gap="sm" >
                        {
                            goalDashboardData.map((data) => (
                                <Group key={data.period} justify="space-between">
                                    <Group gap="xs">
                                        <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: data.period === 'weekly' ? '#228be6' : data.period === 'monthly' ? '#12b886' : '#fab005' }} />
                                        <Text size="sm">{data.label}</Text>
                                    </Group>
                                    <Group gap={4} style={{ textAlign: 'right' }}>
                                        <Text size="sm" fw={700} style={{ minWidth: 60, display: 'inline-block', textAlign: 'right' }}>{data.actual.toLocaleString()}</Text>
                                        <Text size="sm" c="dimmed"> / {data.target.toLocaleString()} {data.unit}</Text>
                                        <Text size="sm" c={data.actual >= data.target ? 'teal' : 'blue'} ml="xs" style={{ minWidth: 45, display: 'inline-block', textAlign: 'right' }}>({Math.round((data.actual / data.target) * 100)}%)</Text>
                                    </Group>
                                </Group>
                            ))
                        }
                    </Stack >

                    <Center mt="xl">
                        <Button variant="light" onClick={() => window.location.href = '/dashboard/profile'}>
                            목표 설정 하러가기
                        </Button>
                    </Center>
                </Card >
            </Stack >
        </Stack >
    );
}
