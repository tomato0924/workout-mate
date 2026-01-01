'use client';

import { Card, Text, Group, Avatar, Stack, Image, Box, ThemeIcon } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { Workout } from '@/types';
import { formatWorkoutDuration, formatWorkoutDistance, formatWorkoutMetric } from '@/lib/utils/format';
import { formatDate, formatCompactDate } from '@/lib/utils/helpers';
import { IconRun, IconSwimming, IconBike, IconMountain, IconWalk, IconEye, IconMessage } from '@tabler/icons-react';

interface WorkoutCardProps {
    workout: Workout;
}

const WORKOUT_IMAGES: Record<string, string> = {
    running: '/images/workout-types/running.jpg',
    swimming: '/images/workout-types/swimming.jpg',
    cycling: '/images/workout-types/cycling.jpg',
    hiking: '/images/workout-types/hiking.jpg',
    treadmill: '/images/workout-types/treadmill.jpg',
};

const WORKOUT_ICONS: Record<string, any> = {
    running: IconRun,
    swimming: IconSwimming,
    cycling: IconBike,
    hiking: IconMountain,
    treadmill: IconWalk,
};

export function WorkoutCard({ workout }: WorkoutCardProps) {
    const router = useRouter();
    const metric = formatWorkoutMetric(workout.distance_meters, workout.duration_seconds, workout.workout_type);
    const TypeIcon = WORKOUT_ICONS[workout.workout_type] || IconRun;

    // Aggregate reactions by emoji
    const reactionCounts = workout.reactions?.reduce((acc: Record<string, number>, reaction) => {
        acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
        return acc;
    }, {}) || {};

    const topReactions = Object.entries(reactionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    const totalReactions = workout.reactions?.length || 0;
    const commentCount = workout.comments?.length || 0;

    // Real view count from DB
    const viewCount = workout.view_count || 0;

    return (
        <Card
            withBorder
            padding={0}
            radius="md"
            onClick={() => router.push(`/dashboard/workouts/${workout.id}`)}
            style={{ cursor: 'pointer', transition: 'transform 0.2s', overflow: 'hidden' }}
            mb="xs"
        >
            <Group gap={0} wrap="nowrap" align="stretch">
                {/* Left: Workout Generic Image */}
                <Box w={90} style={{ position: 'relative', flexShrink: 0, minHeight: 110 }}>
                    <Image
                        src={WORKOUT_IMAGES[workout.workout_type]}
                        h="100%"
                        w="100%"
                        fit="cover"
                        alt={workout.workout_type}
                        style={{ position: 'absolute', top: 0, left: 0 }}
                    />
                    <Box
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ThemeIcon variant="transparent" color="white" size="lg">
                            <TypeIcon size={28} />
                        </ThemeIcon>
                    </Box>
                </Box>

                {/* Right: Content */}
                <Stack gap={4} p="xs" style={{ flex: 1, justifyContent: 'space-between' }}>
                    <Stack gap={8}>
                        <Group justify="space-between" align="center" wrap="nowrap">
                            <Group gap="xs">
                                <Avatar
                                    size="sm"
                                    radius="xl"
                                    src={workout.user?.avatar_url}
                                    name={workout.user?.nickname}
                                    color="blue"
                                >
                                    {workout.user?.nickname?.charAt(0).toUpperCase()}
                                </Avatar>
                                <Text size="sm" fw={500} lineClamp={1}>
                                    {workout.user?.nickname || '알 수 없음'}
                                </Text>
                            </Group>
                            <Text size="xs" c="dimmed">
                                {formatCompactDate(workout.workout_date)}
                            </Text>
                        </Group>

                        <Group gap="lg" align="center">
                            <Stack gap={0}>
                                <Text size="10px" c="dimmed" tt="uppercase">거리</Text>
                                <Text fw={700} size="sm">{formatWorkoutDistance(workout.distance_meters, workout.workout_type)}</Text>
                            </Stack>
                            <Stack gap={0}>
                                <Text size="10px" c="dimmed" tt="uppercase">시간</Text>
                                <Text fw={700} size="sm">{formatWorkoutDuration(workout.duration_seconds)}</Text>
                            </Stack>
                            <Stack gap={0}>
                                <Text size="10px" c="dimmed" tt="uppercase">페이스</Text>
                                <Text fw={700} size="sm">{metric.value}</Text>
                            </Stack>
                        </Group>
                    </Stack>

                    {/* Social Footer */}
                    <Group gap="md" mt={4}>
                        <Group gap={4}>
                            <IconEye size={14} color="gray" />
                            <Text size="xs" c="dimmed">{viewCount}</Text>
                        </Group>
                        <Group gap={4}>
                            <IconMessage size={14} color="gray" />
                            <Text size="xs" c="dimmed">{commentCount}</Text>
                        </Group>
                        {totalReactions > 0 && (
                            <Group gap={2}>
                                {topReactions.map(([emoji]) => (
                                    <Text key={emoji} fz="xs" lh={1}>{emoji}</Text>
                                ))}
                                <Text size="xs" c="dimmed" ml={2}>
                                    {totalReactions > 3 ? `+${totalReactions - 3}` : totalReactions}
                                </Text>
                            </Group>
                        )}
                    </Group>
                </Stack>
            </Group>
        </Card>
    );
}
