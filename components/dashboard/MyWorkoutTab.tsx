
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Title, Stack, Card, Text, Group, Select, SegmentedControl, Grid, Paper, RingProgress, Center, Loader, Button, Image, ActionIcon, Modal, Divider, Checkbox } from '@mantine/core';
import { IconTrophy, IconRun, IconSwimming, IconBike, IconWalk, IconMountain, IconPlus, IconChevronLeft, IconChevronRight, IconSparkles } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Workout, PersonalGoal } from '@/types';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, RadialBarChart, RadialBar, PolarAngleAxis, LabelList } from 'recharts';
import { notifications } from '@mantine/notifications';
import ReactMarkdown from 'react-markdown';

dayjs.extend(isoWeek);

const ACTIVITY_ICONS = {
    running: IconRun,
    swimming: IconSwimming,
    cycling: IconBike,
    hiking: IconMountain,
};

const ACTIVITY_LABELS: Record<string, string> = {
    running: '러닝',
    swimming: '수영',
    cycling: '자전거',
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

    // Chart display options with localStorage persistence
    const [chartOptions, setChartOptions] = useState<{
        showPace: boolean;
        showHeartRate: boolean;
        showCadence: boolean;
        showSwolf: boolean;
        showPower: boolean;
    }>(() => {
        // Default values - only pace is checked by default
        const defaults = {
            showPace: true,
            showHeartRate: false,
            showCadence: false,
            showSwolf: false,
            showPower: false
        };

        // Try to load from localStorage on initial render
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('workoutChartOptions');
                if (saved) {
                    return { ...defaults, ...JSON.parse(saved) };
                }
            } catch (e) {
                console.error('Failed to load chart options:', e);
            }
        }
        return defaults;
    });
    const [touchStart, setTouchStart] = useState<number | null>(null);

    // AI Advisor state
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiAdvice, setAiAdvice] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [goalRecommendations, setGoalRecommendations] = useState<any[]>([]);
    const [applyingGoals, setApplyingGoals] = useState(false);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [previousCoaching, setPreviousCoaching] = useState<{
        content: string;
        goal_recommendations: any[] | null;
        created_at: string;
    } | null>(null);
    const [loadingPreviousCoaching, setLoadingPreviousCoaching] = useState(false);
    const [showingPrevious, setShowingPrevious] = useState(true);

    // Reset date offset when period changes
    useEffect(() => {
        setDateOffset(0);
    }, [period]);

    // Save chart options to localStorage when they change
    useEffect(() => {
        try {
            localStorage.setItem('workoutChartOptions', JSON.stringify(chartOptions));
        } catch (e) {
            console.error('Failed to save chart options:', e);
        }
    }, [chartOptions]);

    const updateChartOption = (key: keyof typeof chartOptions, value: boolean) => {
        setChartOptions(prev => ({ ...prev, [key]: value }));
    };

    // Swipe Handlers
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            // Swipe Left aka "Next" (Newer)
            if (dateOffset > 0) {
                setDateOffset(prev => prev - 1);
            }
        } else if (isRightSwipe) {
            // Swipe Right aka "Prev" (Older)
            setDateOffset(prev => prev + 1);
        }
    };

    // Open AI modal and load previous coaching if exists
    const handleAiAdvice = async () => {
        setAiModalOpen(true);
        setLoadingPreviousCoaching(true);
        setShowingPrevious(true);
        setAiAdvice('');
        setGoalRecommendations([]);

        try {
            // Fetch previous coaching history
            const response = await fetch('/api/ai-workout-advice', {
                method: 'GET',
            });

            if (response.ok) {
                const data = await response.json();
                if (data.coaching) {
                    setPreviousCoaching({
                        content: data.coaching.coaching_content,
                        goal_recommendations: data.coaching.goal_recommendations,
                        created_at: data.coaching.created_at
                    });
                    // Show previous content
                    setAiAdvice(data.coaching.coaching_content);
                    if (data.coaching.goal_recommendations) {
                        setGoalRecommendations(data.coaching.goal_recommendations);
                    }
                } else {
                    setPreviousCoaching(null);
                }
            }
        } catch (error) {
            console.error('Failed to load previous coaching:', error);
            setPreviousCoaching(null);
        } finally {
            setLoadingPreviousCoaching(false);
        }
    };

    // Request new AI coaching
    const handleRequestNewCoaching = async () => {
        setAiLoading(true);
        setShowingPrevious(false);
        setAiAdvice('');
        setGoalRecommendations([]);

        try {
            const response = await fetch('/api/ai-workout-advice', {
                method: 'POST',
            });

            if (!response.ok) {
                let errorMessage = 'AI 조언 생성에 실패했습니다';
                try {
                    const data = await response.json();
                    errorMessage = data.error || errorMessage;
                } catch {
                    // If response is not JSON, use default message
                }
                throw new Error(errorMessage);
            }

            // Read streaming response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('스트림을 읽을 수 없습니다');
            }

            let accumulatedText = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;
                setAiAdvice(accumulatedText);
            }

            // Parse JSON recommendations from response
            let parsedRecommendations: any[] = [];
            try {
                const jsonMatch = accumulatedText.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    const jsonData = JSON.parse(jsonMatch[1]);
                    if (jsonData.goal_recommendations) {
                        parsedRecommendations = jsonData.goal_recommendations;
                        setGoalRecommendations(parsedRecommendations);
                    }
                    // Remove JSON from displayed text
                    accumulatedText = accumulatedText.replace(/```json\s*[\s\S]*?\s*```/g, '').trim();
                    setAiAdvice(accumulatedText);
                }
            } catch (e) {
                console.log('No goal recommendations found');
            }

            // Save coaching to history
            await handleSaveCoaching(accumulatedText, parsedRecommendations);

        } catch (error: any) {
            console.error('AI advice error:', error);
            notifications.show({
                title: '오류',
                message: error.message || 'AI 조언을 불러올 수 없습니다',
                color: 'red',
            });
        } finally {
            setAiLoading(false);
        }
    };

    // Save coaching result to database
    const handleSaveCoaching = async (content: string, recommendations: any[]) => {
        try {
            await fetch('/api/ai-workout-advice', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    coaching_content: content,
                    goal_recommendations: recommendations.length > 0 ? recommendations : null
                })
            });

            // Update previous coaching state
            setPreviousCoaching({
                content,
                goal_recommendations: recommendations.length > 0 ? recommendations : null,
                created_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to save coaching:', error);
        }
    };

    const handleApplyGoals = async () => {
        if (!goalRecommendations || goalRecommendations.length === 0) return;

        setApplyingGoals(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('로그인이 필요합니다');

            for (const rec of goalRecommendations) {
                // Check if goal already exists
                const { data: existing } = await supabase
                    .from('personal_goals')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('activity_type', rec.activity_type)
                    .eq('period_type', rec.period_type)
                    .single();

                let error;
                if (existing) {
                    // Update existing
                    const result = await supabase
                        .from('personal_goals')
                        .update({
                            target_value: rec.recommended_target,
                            metric_type: 'distance',
                            is_active: true
                        })
                        .eq('id', existing.id);
                    error = result.error;
                } else {
                    // Insert new
                    const result = await supabase
                        .from('personal_goals')
                        .insert({
                            user_id: user.id,
                            activity_type: rec.activity_type,
                            period_type: rec.period_type,
                            target_value: rec.recommended_target,
                            metric_type: 'distance',
                            is_active: true
                        });
                    error = result.error;
                }

                if (error) {
                    console.error('Goal save error:', error);
                    throw error;
                }
            }

            notifications.show({
                title: '성공',
                message: 'AI 추천 목표가 적용되었습니다',
                color: 'green'
            });

            setGoalRecommendations([]);
        } catch (error: any) {
            console.error('Apply goals error:', error);
            notifications.show({
                title: '오류',
                message: error.message || '목표 적용에 실패했습니다',
                color: 'red'
            });
        } finally {
            setApplyingGoals(false);
        }
    };

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
            pace: number | null;
            avgHeartRate: number | null;
            avgCadence: number | null;
            avgSwolf: number | null;
            avgPower: number | null;
            workoutCount: number;
            totalHeartRate: number;
            totalCadence: number;
            totalSwolf: number;
            totalPower: number;
            hrCount: number;
            cadenceCount: number;
            swolfCount: number;
            powerCount: number;
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
                pace: null,
                avgHeartRate: null,
                avgCadence: null,
                avgSwolf: null,
                avgPower: null,
                workoutCount: 0,
                totalHeartRate: 0,
                totalCadence: 0,
                totalSwolf: 0,
                totalPower: 0,
                hrCount: 0,
                cadenceCount: 0,
                swolfCount: 0,
                powerCount: 0
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
                match.workoutCount += 1;

                // Aggregate optional metrics
                if (w.avg_heart_rate) {
                    match.totalHeartRate += w.avg_heart_rate;
                    match.hrCount += 1;
                }
                if (w.cadence) {
                    match.totalCadence += w.cadence;
                    match.cadenceCount += 1;
                }
                if (w.swolf) {
                    match.totalSwolf += w.swolf;
                    match.swolfCount += 1;
                }
                if (w.avg_power) {
                    match.totalPower += w.avg_power;
                    match.powerCount += 1;
                }
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

            // Calculate Pace
            // Swimming: min/100m
            // Others: min/km
            let pace = 0;
            if (p.totalDistance > 0) {
                if (activityType === 'swimming') {
                    // min / 100m
                    // totalDuration (sec) / 60 => min
                    // totalDistance (m) / 100 => units
                    pace = (p.totalDuration / 60) / (p.totalDistance / 100);
                } else {
                    // min / km
                    pace = (p.totalDuration / 60) / (p.totalDistance / 1000);
                }
            }

            return {
                ...p,
                value: Math.round(value * 10) / 10,
                pace: pace > 0 ? Math.round(pace * 100) / 100 : null,
                avgHeartRate: p.hrCount > 0 ? Math.round(p.totalHeartRate / p.hrCount) : null,
                avgCadence: p.cadenceCount > 0 ? Math.round(p.totalCadence / p.cadenceCount) : null,
                avgSwolf: p.swolfCount > 0 ? Math.round(p.totalSwolf / p.swolfCount) : null,
                avgPower: p.powerCount > 0 ? Math.round(p.totalPower / p.powerCount) : null
            };
        });
    }, [workouts, activityType, metric, period, dateOffset]);

    // Calculate Y-axis domains for each metric with improved visibility
    const calculateDomain = (values: (number | null)[], defaultMax = 10) => {
        const validValues = values.filter((v): v is number => v !== null && v > 0);
        if (validValues.length === 0) return [0, defaultMax];

        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        const padding = (max - min) * 0.15 || max * 0.1;

        return [
            Math.max(0, min - padding),
            max + padding
        ];
    };

    const paceYAxisDomain = useMemo(() => calculateDomain(chartData.map(d => d.pace)), [chartData]);
    const heartRateDomain = useMemo(() => calculateDomain(chartData.map(d => d.avgHeartRate), 180), [chartData]);
    const cadenceDomain = useMemo(() => calculateDomain(chartData.map(d => d.avgCadence), 200), [chartData]);
    const swolfDomain = useMemo(() => calculateDomain(chartData.map(d => d.avgSwolf), 100), [chartData]);

    const formatPace = (value: number) => {
        if (!value) return '';
        const minutes = Math.floor(value);
        const seconds = Math.round((value - minutes) * 60);
        return `${minutes}'${seconds.toString().padStart(2, '0')}''`;
    };




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
                pv: yearlyData.hasGoal ? Math.min(100, Math.round((yearlyData.actual / yearlyData.target) * 100)) || 0 : 0,
                fill: '#fab005', // Yellow
                target: yearlyData.target,
                actual: yearlyData.actual,
                unit: yearlyData.unit,
                hasGoal: yearlyData.hasGoal
            },
            {
                name: '월간',
                period: 'monthly',
                label: '월간',
                uv: 100,
                pv: monthlyData.hasGoal ? Math.min(100, Math.round((monthlyData.actual / monthlyData.target) * 100)) || 0 : 0,
                fill: '#12b886', // Teal
                target: monthlyData.target,
                actual: monthlyData.actual,
                unit: monthlyData.unit,
                hasGoal: monthlyData.hasGoal
            },
            {
                name: '주간',
                period: 'weekly',
                label: '주간',
                uv: 100, // Background ring (always 100%)
                pv: weeklyData.hasGoal ? Math.min(100, Math.round((weeklyData.actual / weeklyData.target) * 100)) || 0 : 0,
                fill: '#228be6', // Blue
                target: weeklyData.target,
                actual: weeklyData.actual,
                unit: weeklyData.unit,
                hasGoal: weeklyData.hasGoal
            }
        ];

        return chartData;
    }, [goals, workouts, activityType]);

    // Check if any goal is missing
    const hasAnyMissingGoal = useMemo(() => {
        return goalDashboardData.some(d => !d.hasGoal);
    }, [goalDashboardData]);

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
                                { label: '러닝', value: 'running' },
                                { label: '수영', value: 'swimming' },
                                { label: '자전거', value: 'cycling' },
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
                        <Title order={4}>
                            {ACTIVITY_LABELS[activityType]} 기록 추이
                        </Title>
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

                <Group justify="flex-end" mb="xs" gap="md">
                    <Checkbox
                        label="페이스"
                        checked={chartOptions.showPace}
                        onChange={(e) => updateChartOption('showPace', e.currentTarget.checked)}
                        size="sm"
                    />
                    {/* Swimming specific options */}
                    {activityType === 'swimming' && (
                        <>
                            <Checkbox
                                label="SWOLF"
                                checked={chartOptions.showSwolf}
                                onChange={(e) => updateChartOption('showSwolf', e.currentTarget.checked)}
                                size="sm"
                            />
                            <Checkbox
                                label="심박수"
                                checked={chartOptions.showHeartRate}
                                onChange={(e) => updateChartOption('showHeartRate', e.currentTarget.checked)}
                                size="sm"
                            />
                        </>
                    )}
                    {/* Running specific options */}
                    {activityType === 'running' && (
                        <>
                            <Checkbox
                                label="케이던스"
                                checked={chartOptions.showCadence}
                                onChange={(e) => updateChartOption('showCadence', e.currentTarget.checked)}
                                size="sm"
                            />
                            <Checkbox
                                label="심박수"
                                checked={chartOptions.showHeartRate}
                                onChange={(e) => updateChartOption('showHeartRate', e.currentTarget.checked)}
                                size="sm"
                            />
                        </>
                    )}
                    {/* Cycling specific options */}
                    {activityType === 'cycling' && (
                        <>
                            <Checkbox
                                label="케이던스"
                                checked={chartOptions.showCadence}
                                onChange={(e) => updateChartOption('showCadence', e.currentTarget.checked)}
                                size="sm"
                            />
                            <Checkbox
                                label="파워"
                                checked={chartOptions.showPower}
                                onChange={(e) => updateChartOption('showPower', e.currentTarget.checked)}
                                size="sm"
                            />
                            <Checkbox
                                label="심박수"
                                checked={chartOptions.showHeartRate}
                                onChange={(e) => updateChartOption('showHeartRate', e.currentTarget.checked)}
                                size="sm"
                            />
                        </>
                    )}
                </Group>

                <div
                    style={{ height: 300, position: 'relative' }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    {/* Navigation Overlays */}
                    <ActionIcon
                        variant="transparent"
                        color="gray"
                        size="lg"
                        style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
                        onClick={() => setDateOffset(prev => prev + 1)}
                    >
                        <IconChevronLeft size={32} />
                    </ActionIcon>

                    <ActionIcon
                        variant="transparent"
                        color="gray"
                        size="lg"
                        style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
                        onClick={() => setDateOffset(prev => prev - 1)}
                        disabled={dateOffset <= 0}
                    >
                        <IconChevronRight size={32} />
                    </ActionIcon>

                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" fontSize={12} tickMargin={10} />
                            {/* Left Axis: Hidden */}
                            <YAxis hide yAxisId="left" />
                            {/* Right Axis: Dynamic domain based on active metrics */}
                            <YAxis
                                hide
                                yAxisId="right"
                                orientation="right"
                                domain={(() => {
                                    // Collect all active metric values
                                    const allValues: (number | null)[] = [];
                                    if (chartOptions.showPace) allValues.push(...chartData.map(d => d.pace));
                                    if (chartOptions.showHeartRate) allValues.push(...chartData.map(d => d.avgHeartRate));
                                    if (chartOptions.showCadence && (activityType === 'running' || activityType === 'cycling')) allValues.push(...chartData.map(d => d.avgCadence));
                                    if (chartOptions.showSwolf && activityType === 'swimming') allValues.push(...chartData.map(d => d.avgSwolf));
                                    if (chartOptions.showPower && activityType === 'cycling') allValues.push(...chartData.map(d => d.avgPower));

                                    const validValues = allValues.filter((v): v is number => v !== null && v > 0);
                                    if (validValues.length === 0) return [0, 100];

                                    const min = Math.min(...validValues);
                                    const max = Math.max(...validValues);
                                    const padding = (max - min) * 0.15 || max * 0.1;

                                    return [Math.max(0, min - padding), max + padding];
                                })()}
                            />


                            <Bar yAxisId="left" dataKey="value" name={metric === 'distance' ? '거리' : '시간'} fill="#228be6" radius={[4, 4, 0, 0]}>
                                <LabelList
                                    dataKey="value"
                                    position="top"
                                    formatter={(value: any) => value > 0 ? `${value}${unitLabel}` : ''}
                                    style={{ fontSize: 12, fill: '#666' }}
                                />
                                <Cell fill="#228be6" />
                            </Bar>

                            {/* Pace Overlay Line */}
                            {chartOptions.showPace && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="pace"
                                    name="페이스"
                                    stroke="#ff6b6b"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#ff6b6b' }}
                                    connectNulls={true}
                                >
                                    <LabelList
                                        dataKey="pace"
                                        position="top"
                                        content={({ x, y, value }) => (
                                            value != null ? (
                                                <text x={x} y={Number(y) - 10} fill="#ff6b6b" fontSize={10} textAnchor="middle">
                                                    {formatPace(Number(value))}
                                                </text>
                                            ) : null
                                        )}
                                    />
                                </Line>
                            )}

                            {/* Heart Rate Line */}
                            {chartOptions.showHeartRate && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="avgHeartRate"
                                    name="심박수"
                                    stroke="#e599f7"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#e599f7' }}
                                    connectNulls={true}
                                >
                                    <LabelList
                                        dataKey="avgHeartRate"
                                        position="top"
                                        content={({ x, y, value }) => (
                                            value != null ? (
                                                <text x={x} y={Number(y) - 10} fill="#e599f7" fontSize={10} textAnchor="middle">
                                                    {value}bpm
                                                </text>
                                            ) : null
                                        )}
                                    />
                                </Line>
                            )}

                            {/* Cadence Line (Running only - spm) */}
                            {chartOptions.showCadence && activityType === 'running' && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="avgCadence"
                                    name="케이던스"
                                    stroke="#74c0fc"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#74c0fc' }}
                                    connectNulls={true}
                                >
                                    <LabelList
                                        dataKey="avgCadence"
                                        position="top"
                                        content={({ x, y, value }) => (
                                            value != null ? (
                                                <text x={x} y={Number(y) - 10} fill="#74c0fc" fontSize={10} textAnchor="middle">
                                                    {value}spm
                                                </text>
                                            ) : null
                                        )}
                                    />
                                </Line>
                            )}

                            {/* Cadence Line (Cycling only - rpm) */}
                            {chartOptions.showCadence && activityType === 'cycling' && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="avgCadence"
                                    name="케이던스"
                                    stroke="#74c0fc"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#74c0fc' }}
                                    connectNulls={true}
                                >
                                    <LabelList
                                        dataKey="avgCadence"
                                        position="top"
                                        content={({ x, y, value }) => (
                                            value != null ? (
                                                <text x={x} y={Number(y) - 10} fill="#74c0fc" fontSize={10} textAnchor="middle">
                                                    {value}rpm
                                                </text>
                                            ) : null
                                        )}
                                    />
                                </Line>
                            )}

                            {/* Power Line (Cycling only) */}
                            {chartOptions.showPower && activityType === 'cycling' && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="avgPower"
                                    name="파워"
                                    stroke="#ffd43b"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#ffd43b' }}
                                    connectNulls={true}
                                >
                                    <LabelList
                                        dataKey="avgPower"
                                        position="top"
                                        content={({ x, y, value }) => (
                                            value != null ? (
                                                <text x={x} y={Number(y) - 10} fill="#ffd43b" fontSize={10} textAnchor="middle">
                                                    {value}W
                                                </text>
                                            ) : null
                                        )}
                                    />
                                </Line>
                            )}

                            {/* SWOLF Line (Swimming only) */}
                            {chartOptions.showSwolf && activityType === 'swimming' && (
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="avgSwolf"
                                    name="SWOLF"
                                    stroke="#69db7c"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#69db7c' }}
                                    connectNulls={true}
                                >
                                    <LabelList
                                        dataKey="avgSwolf"
                                        position="top"
                                        content={({ x, y, value }) => (
                                            value != null ? (
                                                <text x={x} y={Number(y) - 10} fill="#69db7c" fontSize={10} textAnchor="middle">
                                                    {value}
                                                </text>
                                            ) : null
                                        )}
                                    />
                                </Line>
                            )}
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
                                        {data.hasGoal ? (
                                            <>
                                                <Text size="sm" fw={700} style={{ minWidth: 60, display: 'inline-block', textAlign: 'right' }}>{data.actual.toLocaleString()}</Text>
                                                <Text size="sm" c="dimmed"> / {data.target.toLocaleString()} {data.unit}</Text>
                                                <Text size="sm" c={data.actual >= data.target ? 'teal' : 'blue'} ml="xs" style={{ minWidth: 45, display: 'inline-block', textAlign: 'right' }}>({Math.round((data.actual / data.target) * 100)}%)</Text>
                                            </>
                                        ) : (
                                            <Text size="sm" c="dimmed" fs="italic">목표 미설정</Text>
                                        )}
                                    </Group>
                                </Group>
                            ))
                        }
                    </Stack >

                    {/* Speech bubble prompt when goals are missing */}
                    {hasAnyMissingGoal && (
                        <Paper
                            p="md"
                            mt="lg"
                            withBorder
                            radius="md"
                            style={{
                                backgroundColor: '#fff9db',
                                borderColor: '#fab005',
                                position: 'relative'
                            }}
                        >
                            <Group gap="xs" align="center">
                                <Text size="sm" c="orange.8">
                                    💬 운동 목표를 설정하면 달성률을 확인할 수 있어요!
                                </Text>
                            </Group>
                        </Paper>
                    )}

                    <Center mt="xl">
                        <Button
                            variant={hasAnyMissingGoal ? "gradient" : "light"}
                            gradient={hasAnyMissingGoal ? { from: 'orange', to: 'yellow', deg: 45 } : undefined}
                            size={hasAnyMissingGoal ? "md" : "sm"}
                            onClick={() => window.location.href = `/dashboard/profile?tab=goals&activity=${activityType}`}
                        >
                            {ACTIVITY_LABELS[activityType]} 목표 설정하기
                        </Button>
                    </Center>

                    {/* AI Pacemaker Button */}
                    <Center mt="xl">
                        <Button
                            variant="gradient"
                            gradient={{ from: 'indigo', to: 'cyan', deg: 45 }}
                            size="lg"
                            leftSection={<IconSparkles size={20} />}
                            onClick={handleAiAdvice}
                            loading={aiLoading}
                        >
                            AI 페이스메이커
                        </Button>
                    </Center>
                </Card >
            </Stack >

            {/* AI Advice Modal */}
            <Modal
                opened={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                title={<Group><IconSparkles size={24} /><Text fw={700}>AI 운동 코치 조언</Text></Group>}
                size="lg"
                styles={{
                    body: { maxHeight: '70vh', overflowY: 'auto' },
                }}
            >
                {/* Loading previous coaching */}
                {loadingPreviousCoaching ? (
                    <Center h={200}>
                        <Loader size="lg" />
                    </Center>
                ) : (
                    <Stack gap="md">
                        {/* Previous coaching timestamp and new coaching button */}
                        {previousCoaching && showingPrevious && !aiLoading && (
                            <>
                                <Paper p="sm" withBorder bg="gray.0" radius="md">
                                    <Group justify="space-between" align="center">
                                        <Text size="sm" c="dimmed">
                                            📅 {new Date(previousCoaching.created_at).toLocaleString('ko-KR', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })} 코칭
                                        </Text>
                                        <Button
                                            size="xs"
                                            variant="gradient"
                                            gradient={{ from: 'indigo', to: 'cyan', deg: 45 }}
                                            onClick={handleRequestNewCoaching}
                                            leftSection={<IconSparkles size={14} />}
                                        >
                                            새롭게 코칭받기
                                        </Button>
                                    </Group>
                                </Paper>

                                {/* Previous coaching content */}
                                <Paper p="md" withBorder>
                                    <ReactMarkdown
                                        components={{
                                            h1: ({ ...props }) => <Title order={2} mt="lg" mb="md" {...props as any} />,
                                            h2: ({ ...props }) => <Title order={3} mt="md" mb="sm" {...props as any} />,
                                            h3: ({ ...props }) => <Title order={4} mt="sm" mb="xs" {...props as any} />,
                                            p: ({ ...props }) => <Text mb="sm" {...props as any} />,
                                            ul: ({ ...props }) => <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }} {...props as any} />,
                                            ol: ({ ...props }) => <ol style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }} {...props as any} />,
                                            li: ({ ...props }) => <li style={{ marginBottom: '0.5rem' }} {...props as any} />,
                                            strong: ({ ...props }) => <Text span fw={700} {...props as any} />,
                                        }}
                                    >
                                        {previousCoaching.content}
                                    </ReactMarkdown>

                                    {/* Goal recommendations from previous coaching */}
                                    {previousCoaching.goal_recommendations && previousCoaching.goal_recommendations.length > 0 && (
                                        <>
                                            <Divider my="lg" label="AI 목표 추천" labelPosition="center" />
                                            <Stack gap="sm">
                                                {previousCoaching.goal_recommendations.map((rec: any, idx: number) => (
                                                    <Paper key={idx} p="sm" withBorder bg="blue.0">
                                                        <Text size="sm" fw={600}>
                                                            {rec.activity_type} ({rec.period_type})
                                                        </Text>
                                                        <Text size="sm">
                                                            현재: {rec.current_target} → 추천: {rec.recommended_target}
                                                        </Text>
                                                        <Text size="xs" c="dimmed">{rec.reason}</Text>
                                                    </Paper>
                                                ))}
                                                <Button
                                                    onClick={handleApplyGoals}
                                                    loading={applyingGoals}
                                                    fullWidth
                                                >
                                                    추천 목표 적용하기
                                                </Button>
                                            </Stack>
                                        </>
                                    )}
                                </Paper>
                            </>
                        )}

                        {/* No previous coaching - prompt for new */}
                        {!previousCoaching && !aiLoading && !aiAdvice && (
                            <Center py="xl">
                                <Stack align="center" gap="md">
                                    <IconSparkles size={48} color="gray" />
                                    <Text c="dimmed" ta="center">
                                        아직 코칭 기록이 없습니다.<br />
                                        AI 코치에게 맞춤 조언을 받아보세요!
                                    </Text>
                                    <Button
                                        variant="gradient"
                                        gradient={{ from: 'indigo', to: 'cyan', deg: 45 }}
                                        onClick={handleRequestNewCoaching}
                                        leftSection={<IconSparkles size={16} />}
                                        size="md"
                                    >
                                        AI 코칭 시작하기
                                    </Button>
                                </Stack>
                            </Center>
                        )}

                        {/* Loading new coaching */}
                        {aiLoading && !aiAdvice && (
                            <Center h={200}>
                                <Stack align="center" gap="sm">
                                    <Loader size="lg" />
                                    <Text size="sm" c="dimmed">AI가 분석 중입니다...</Text>
                                </Stack>
                            </Center>
                        )}

                        {/* Coaching content */}
                        {aiAdvice && (
                            <Paper p="md" withBorder>
                                <ReactMarkdown
                                    components={{
                                        h1: ({ ...props }) => <Title order={2} mt="lg" mb="md" {...props as any} />,
                                        h2: ({ ...props }) => <Title order={3} mt="md" mb="sm" {...props as any} />,
                                        h3: ({ ...props }) => <Title order={4} mt="sm" mb="xs" {...props as any} />,
                                        p: ({ ...props }) => <Text mb="sm" {...props as any} />,
                                        ul: ({ ...props }) => <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }} {...props as any} />,
                                        ol: ({ ...props }) => <ol style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }} {...props as any} />,
                                        li: ({ ...props }) => <li style={{ marginBottom: '0.5rem' }} {...props as any} />,
                                        strong: ({ ...props }) => <Text span fw={700} {...props as any} />,
                                    }}
                                >
                                    {aiAdvice}
                                </ReactMarkdown>

                                {/* Goal recommendations */}
                                {goalRecommendations.length > 0 && (
                                    <>
                                        <Divider my="lg" label="AI 목표 추천" labelPosition="center" />
                                        <Stack gap="sm">
                                            {goalRecommendations.map((rec: any, idx: number) => (
                                                <Paper key={idx} p="sm" withBorder bg="blue.0">
                                                    <Text size="sm" fw={600}>
                                                        {rec.activity_type} ({rec.period_type})
                                                    </Text>
                                                    <Text size="sm">
                                                        현재: {rec.current_target} → 추천: {rec.recommended_target}
                                                    </Text>
                                                    <Text size="xs" c="dimmed">{rec.reason}</Text>
                                                </Paper>
                                            ))}
                                            <Button
                                                onClick={handleApplyGoals}
                                                loading={applyingGoals}
                                                fullWidth
                                            >
                                                추천 목표 적용하기
                                            </Button>
                                        </Stack>
                                    </>
                                )}

                                {/* New coaching button after viewing current */}
                                {!showingPrevious && !aiLoading && (
                                    <Center mt="lg">
                                        <Button
                                            variant="light"
                                            size="sm"
                                            onClick={handleRequestNewCoaching}
                                            leftSection={<IconSparkles size={14} />}
                                        >
                                            다시 코칭받기
                                        </Button>
                                    </Center>
                                )}
                            </Paper>
                        )}
                    </Stack>
                )}
            </Modal>
        </Stack >
    );
}
