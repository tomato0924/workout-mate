'use client';

import { Card, Text, Group, Badge, Stack, Image } from '@mantine/core';
import { IconHeart, IconMessageCircle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { Workout } from '@/types';
import { WORKOUT_TYPES } from '@/lib/utils/constants';
import { formatWorkoutDuration, formatWorkoutDistance, formatWorkoutMetric } from '@/lib/utils/format';
import { formatDate } from '@/lib/utils/helpers';

interface WorkoutCardProps {
    workout: Workout;
}

export function WorkoutCard({ workout }: WorkoutCardProps) {
    const router = useRouter();

    const getWorkoutTypeLabel = (type: string) => {
        return WORKOUT_TYPES.find(t => t.value === type)?.label || type;
    };

    const metric = formatWorkoutMetric(workout.distance_meters, workout.duration_seconds, workout.workout_type);

    const hasImage = workout.images && workout.images.length > 0;

    return (
        <Card
            withBorder
            padding="lg"
            radius="md"
            onClick={() => router.push(`/dashboard/workouts/${workout.id}`)}
            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            mb="sm"
        >
            <Group align="flex-start" wrap="nowrap">
                <Stack gap="sm" style={{ flex: 1 }}>
                    <Group justify="space-between">
                        <Group gap="xs">
                            <Text fw={600}>{workout.user?.nickname || '사용자'}</Text>
                            <Text size="xs" c="dimmed">• {formatDate(workout.workout_date)}</Text>
                        </Group>
                        <Badge variant="light" color="blue">{getWorkoutTypeLabel(workout.workout_type)}</Badge>
                    </Group>

                    <Group gap="xl" mt="xs">
                        <div>
                            <Text size="xs" c="dimmed">거리</Text>
                            <Text fw={600} size="lg">{formatWorkoutDistance(workout.distance_meters, workout.workout_type)}</Text>
                        </div>
                        <div>
                            <Text size="xs" c="dimmed">시간</Text>
                            <Text fw={600} size="lg">{formatWorkoutDuration(workout.duration_seconds)}</Text>
                        </div>
                        <div>
                            <Text size="xs" c="dimmed">{metric.label}</Text>
                            <Text fw={600} size="lg">{metric.value}</Text>
                        </div>

                        {workout.avg_heart_rate && (
                            <div>
                                <Text size="xs" c="dimmed">심박수</Text>
                                <Text fw={600} size="lg">{workout.avg_heart_rate} bpm</Text>
                            </div>
                        )}
                    </Group>

                    <Group gap="md" mt="sm">
                        <Group gap={4}>
                            <IconHeart size={16} color="gray" />
                            <Text size="sm" c="dimmed">{(workout.reactions?.[0] as any)?.count || 0}</Text>
                        </Group>
                        <Group gap={4}>
                            <IconMessageCircle size={16} color="gray" />
                            <Text size="sm" c="dimmed">{(workout.comments?.[0] as any)?.count || 0}</Text>
                        </Group>
                    </Group>
                </Stack>

                {hasImage && (
                    <Image
                        src={workout.images![0].image_url}
                        w={100}
                        h={100}
                        radius="md"
                        fit="cover"
                        alt="Workout thumbnail"
                        style={{ alignSelf: 'center' }}
                    />
                )}
            </Group>
        </Card>
    );
}
