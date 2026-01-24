'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    Container,
    Title,
    Paper,
    Stack,
    Group,
    Badge,
    Text,
    Button,
    Textarea,
    ActionIcon,
    Avatar,
    Loader,
    Center,
    Image,
    Grid,
    Modal,
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconHeart, IconMessageCircle, IconArrowLeft, IconPencil, IconTrash, IconEye } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { Workout, WorkoutComment, WorkoutReaction } from '@/types';
import { WORKOUT_TYPES, REACTION_EMOJIS } from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/helpers';
import { formatWorkoutDuration, formatWorkoutDistance, formatWorkoutMetric } from '@/lib/utils/format';

export default function WorkoutDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [workout, setWorkout] = useState<Workout | null>(null);
    const [comments, setComments] = useState<WorkoutComment[]>([]);
    const [reactions, setReactions] = useState<WorkoutReaction[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [opened, { open, close }] = useDisclosure(false);

    const supabase = createClient();
    const hasViewedRef = useRef(false);
    const searchParams = useSearchParams();

    const [currentUser, setCurrentUser] = useState<any>(null);

    const handleBack = () => {
        const from = searchParams.get('from');
        if (from === 'feed') {
            router.push('/dashboard?tab=feed');
        } else {
            router.push('/dashboard');
        }
    };

    useEffect(() => {
        loadWorkout();
    }, [params.id]);

    const loadWorkout = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);

            // Increment view count (once per session/mount)
            if (!hasViewedRef.current) {
                await supabase.rpc('increment_workout_view_count', { workout_id: params.id });
                hasViewedRef.current = true;
            }

            const { data, error } = await supabase
                .from('workouts')
                .select(`
          *,
          user:user_profiles(*),
          images:workout_images(*)
        `)
                .eq('id', params.id)
                .single();

            if (error) throw error;
            setWorkout(data);

            loadComments();
            loadReactions();
        } catch (error) {
            console.error('Load workout error:', error);
            notifications.show({
                title: '오류',
                message: '운동 기록을 불러올 수 없습니다',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('정말로 이 운동 기록을 삭제하시겠습니까?')) return;

        try {
            const { error } = await supabase
                .from('workouts')
                .delete()
                .eq('id', params.id);

            if (error) throw error;

            notifications.show({ title: '성공', message: '삭제되었습니다', color: 'blue' });
            router.push('/dashboard');
        } catch (error) {
            console.error('Delete error', error);
            notifications.show({ title: '오류', message: '삭제 실패', color: 'red' });
        }
    };


    const loadComments = async () => {
        const { data } = await supabase
            .from('workout_comments')
            .select('*, user:user_profiles(*)')
            .eq('workout_id', params.id)
            .order('created_at', { ascending: true });

        if (data) setComments(data);
    };

    const loadReactions = async () => {
        const { data } = await supabase
            .from('workout_reactions')
            .select('*, user:user_profiles(*)')
            .eq('workout_id', params.id);

        if (data) setReactions(data);
    };

    const handleAddReaction = async (emoji: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Check if user already reacted
            const existing = reactions.find(r => r.user_id === user.id);
            if (existing) {
                await supabase.from('workout_reactions').delete().eq('id', existing.id);
            }

            await supabase.from('workout_reactions').insert({
                workout_id: params.id as string,
                user_id: user.id,
                emoji,
            });

            loadReactions();
        } catch (error) {
            console.error('Add reaction error:', error);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase.from('workout_comments').insert({
                workout_id: params.id as string,
                user_id: user.id,
                content: newComment,
            });

            setNewComment('');
            loadComments();
            notifications.show({
                message: '댓글이 추가되었습니다',
                color: 'green',
            });
        } catch (error) {
            console.error('Add comment error:', error);
        }
    };

    const openImageModal = (url: string) => {
        setSelectedImage(url);
        open();
    };

    if (loading) {
        return (
            <Center h={400}>
                <Loader />
            </Center>
        );
    }

    if (!workout) {
        return (
            <Container>
                <Text>운동 기록을 찾을 수 없습니다</Text>
            </Container>
        );
    }

    const workoutTypeLabel = WORKOUT_TYPES.find(t => t.value === workout.workout_type)?.label;

    return (
        <Container size="md">
            <Group justify="space-between" mb="md">
                <Button
                    variant="subtle"
                    color="gray"
                    leftSection={<IconArrowLeft size={16} />}
                    onClick={() => router.back()}
                >
                    목록으로 돌아가기
                </Button>
                {currentUser && workout && currentUser.id === workout.user_id && (
                    <Group>
                        <Button
                            variant="light"
                            color="blue"
                            size="xs"
                            leftSection={<IconPencil size={14} />}
                            onClick={() => router.push(`/dashboard/workouts/${workout.id}/edit`)}
                        >
                            수정
                        </Button>
                        <Button
                            variant="light"
                            color="red"
                            size="xs"
                            leftSection={<IconTrash size={14} />}
                            onClick={handleDelete}
                        >
                            삭제
                        </Button>
                    </Group>
                )}
            </Group>
            <Paper withBorder shadow="sm" p="lg">
                <Stack>

                    <Group justify="space-between">
                        <Group>
                            <Avatar radius="xl" src={workout.user?.avatar_url}>{workout.user?.nickname.charAt(0)}</Avatar>
                            <div>
                                <Text fw={600}>{workout.user?.nickname}</Text>
                                <Group gap={8}>
                                    <Text size="sm" c="dimmed">{formatDate(workout.workout_date)}</Text>
                                    <Group gap={4}>
                                        <IconEye size={14} color="gray" />
                                        <Text size="sm" c="dimmed">{workout.view_count || 0}</Text>
                                    </Group>
                                </Group>
                            </div>
                        </Group>
                        <Badge size="lg">{workoutTypeLabel}</Badge>
                    </Group>

                    <Grid>
                        <Grid.Col span={{ base: 6, sm: 3 }}>
                            <div>
                                <Text size="xs" c="dimmed">거리</Text>
                                <Text fw={600} size="lg">{formatWorkoutDistance(workout.distance_meters, workout.workout_type)}</Text>
                            </div>
                        </Grid.Col>
                        <Grid.Col span={{ base: 6, sm: 3 }}>
                            <div>
                                <Text size="xs" c="dimmed">시간</Text>
                                <Text fw={600} size="lg">{formatWorkoutDuration(workout.duration_seconds)}</Text>
                            </div>
                        </Grid.Col>
                        <Grid.Col span={{ base: 6, sm: 3 }}>
                            <div>
                                <Text size="xs" c="dimmed">{formatWorkoutMetric(workout.distance_meters, workout.duration_seconds, workout.workout_type).label}</Text>
                                <Text fw={600} size="lg">{formatWorkoutMetric(workout.distance_meters, workout.duration_seconds, workout.workout_type).value}</Text>
                            </div>
                        </Grid.Col>
                        {workout.avg_heart_rate && (
                            <Grid.Col span={{ base: 6, sm: 3 }}>
                                <div>
                                    <Text size="xs" c="dimmed">평균 심박수</Text>
                                    <Text fw={600} size="lg">{workout.avg_heart_rate} bpm</Text>
                                </div>
                            </Grid.Col>
                        )}
                        {workout.cadence && (
                            <Grid.Col span={{ base: 6, sm: 3 }}>
                                <div>
                                    <Text size="xs" c="dimmed">케이던스</Text>
                                    <Text fw={600} size="lg">{workout.cadence} spm</Text>
                                </div>
                            </Grid.Col>
                        )}
                        {workout.swolf && (
                            <Grid.Col span={{ base: 6, sm: 3 }}>
                                <div>
                                    <Text size="xs" c="dimmed">SWOLF</Text>
                                    <Text fw={600} size="lg">{workout.swolf}</Text>
                                </div>
                            </Grid.Col>
                        )}
                    </Grid>

                    {workout.images && workout.images.length > 0 && (
                        <div>
                            {workout.images.length === 1 ? (
                                <Image
                                    src={workout.images[0].image_url}
                                    alt="Workout"
                                    onClick={() => openImageModal(workout.images![0].image_url)}
                                    style={{ cursor: 'pointer' }}
                                />
                            ) : (
                                <Carousel withIndicators loop>
                                    {workout.images.map((img, index) => (
                                        <Carousel.Slide key={img.id}>
                                            <Image
                                                src={img.image_url}
                                                alt={`Workout ${index + 1}`}
                                                onClick={() => openImageModal(img.image_url)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </Carousel.Slide>
                                    ))}
                                </Carousel>
                            )}
                        </div>
                    )}

                    <Group>
                        {REACTION_EMOJIS.map(emoji => (
                            <ActionIcon
                                key={emoji}
                                variant="light"
                                size="lg"
                                onClick={() => handleAddReaction(emoji)}
                            >
                                {emoji}
                            </ActionIcon>
                        ))}
                    </Group>

                    <div>
                        <Text size="sm" fw={500} mb="xs">
                            반응 ({reactions.length})
                        </Text>
                        <Group gap="xs">
                            {reactions.map(reaction => (
                                <Badge key={reaction.id} variant="light">
                                    {reaction.emoji} {reaction.user?.nickname}
                                </Badge>
                            ))}
                        </Group>
                    </div>

                    <div>
                        <Text size="sm" fw={500} mb="xs">
                            댓글 ({comments.length})
                        </Text>
                        <Stack gap="sm">
                            {comments.map(comment => (
                                <Paper key={comment.id} withBorder p="sm">
                                    <Group>
                                        <Avatar size="sm" radius="xl">
                                            {comment.user?.nickname.charAt(0)}
                                        </Avatar>
                                        <div style={{ flex: 1 }}>
                                            <Text size="sm" fw={500}>{comment.user?.nickname}</Text>
                                            <Text size="sm">{comment.content}</Text>
                                        </div>
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    </div>

                    <Group>
                        <Textarea
                            placeholder="댓글을 입력하세요..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.currentTarget.value)}
                            style={{ flex: 1 }}
                        />
                        <Button onClick={handleAddComment}>댓글 추가</Button>
                    </Group>
                </Stack>
            </Paper>

            <Modal opened={opened} onClose={close} size="xl" title="사진 보기">
                {selectedImage && <Image src={selectedImage} alt="Full size" />}
            </Modal>
        </Container>
    );
}
