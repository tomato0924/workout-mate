'use client';

import { useEffect, useState } from 'react';
import { Title, Stack, Card, Text, Group, Button, Select, Loader, Center, Grid } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Workout } from '@/types';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import dayjs from 'dayjs';

export function FeedTab() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('public');
    const [dateRange, setDateRange] = useState<string>('1month');
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        loadWorkouts();
    }, [filter, dateRange]);

    const loadWorkouts = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            let query = supabase
                .from('workouts')
                .select(`
                    *,
                    view_count,
                    user:user_profiles(*),
                    images:workout_images(*),
                    reactions:workout_reactions(emoji),
                    comments:workout_comments(id)
                `)
                .order('created_at', { ascending: false })
                .limit(50); // Increased limit as we have date filters

            // Apply User Filter
            if (filter === 'my' && user) {
                query = query.eq('user_id', user.id);
            } else if (filter === 'public') {
                query = query.eq('sharing_type', 'public');
            }

            // Apply Date Filter
            const now = dayjs();
            let startDate;

            if (dateRange === '1week') startDate = now.subtract(1, 'week');
            else if (dateRange === '1month') startDate = now.subtract(1, 'month');
            else if (dateRange === '3months') startDate = now.subtract(3, 'month');

            if (startDate) {
                query = query.gte('created_at', startDate.toISOString());
            }

            const { data, error } = await query;

            if (error) {
                console.error('Load workouts error:', error);
                return;
            }

            setWorkouts(data || []);
        } catch (error) {
            console.error('Load workouts error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Stack mt="md">
            <Group justify="space-between">
                <Group>
                    <Select
                        placeholder="필터"
                        value={filter}
                        onChange={(value) => setFilter(value || 'all')}
                        data={[
                            { value: 'my', label: '내 운동' },
                            { value: 'public', label: '공개 운동' },
                        ]}
                        w={150}
                    />
                    <Select
                        placeholder="기간"
                        value={dateRange}
                        onChange={(value) => setDateRange(value || '1month')}
                        data={[
                            { value: '1week', label: '최근 1주일' },
                            { value: '1month', label: '최근 1개월' },
                            { value: '3months', label: '최근 3개월' },
                            { value: 'all', label: '전체 기간' },
                        ]}
                        w={150}
                    />
                </Group>
                <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/dashboard/workouts/new')}>
                    운동 기록
                </Button>
            </Group>

            {loading ? (
                <Center h={200}>
                    <Loader />
                </Center>
            ) : workouts.length === 0 ? (
                <Card withBorder p="xl">
                    <Text c="dimmed" ta="center">
                        선택한 조건의 운동 기록이 없습니다.
                    </Text>
                </Card>
            ) : (
                <Stack>
                    {workouts.map((workout) => (
                        <WorkoutCard key={workout.id} workout={workout} fromTab="feed" />
                    ))}
                </Stack>
            )}
        </Stack>
    );
}
