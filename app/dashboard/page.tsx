'use client';

import { useEffect, useState } from 'react';
import { Title, Container, Stack, Card, Text, Group, Badge, Button, Select, Loader, Center } from '@mantine/core';
import { IconPlus, IconHeart, IconMessageCircle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Workout } from '@/types';
import { WORKOUT_TYPES } from '@/lib/utils/constants';
import { WorkoutCard } from '@/components/workout/WorkoutCard';

export default function DashboardPage() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        loadWorkouts();
    }, [filter]);

    const loadWorkouts = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let query = supabase
                .from('workouts')
                .select(`
          *,
          user:user_profiles(*),
          images:workout_images(*),
          reactions:workout_reactions(count),
          comments:workout_comments(count)
        `)
                .order('created_at', { ascending: false })
                .limit(20);

            if (filter === 'my') {
                query = query.eq('user_id', user.id);
            } else if (filter === 'public') {
                query = query.eq('sharing_type', 'public');
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
        <Container size="md">
            <Stack>
                <Group justify="space-between">
                    <Title order={2}>운동 피드</Title>
                    <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/dashboard/workouts/new')}>
                        운동 기록
                    </Button>
                </Group>

                <Select
                    label="필터"
                    value={filter}
                    onChange={(value) => setFilter(value || 'all')}
                    data={[
                        { value: 'all', label: '전체' },
                        { value: 'my', label: '내 운동' },
                        { value: 'public', label: '공개 운동' },
                    ]}
                />

                {loading ? (
                    <Center h={200}>
                        <Loader />
                    </Center>
                ) : workouts.length === 0 ? (
                    <Card withBorder p="xl">
                        <Text c="dimmed" ta="center">
                            운동 기록이 없습니다. 첫 운동을 기록해보세요!
                        </Text>
                    </Card>
                ) : (
                    <Stack>
                        {workouts.map((workout) => (
                            <WorkoutCard key={workout.id} workout={workout} />
                        ))}
                    </Stack>
                )}
            </Stack>
        </Container>
    );
}
