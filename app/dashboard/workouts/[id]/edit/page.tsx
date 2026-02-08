'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    Container,
    Title,
    Paper,
    Stack,
    Select,
    NumberInput,
    Button,
    Group,
    FileButton,
    Image,
    Text,
    Grid,
    ActionIcon,
    Loader,
    Center,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX, IconUpload } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { WORKOUT_TYPES, SHARING_TYPES, MAX_WORKOUT_IMAGES } from '@/lib/utils/constants';
import type { WorkoutType } from '@/types';

export default function EditWorkoutPage() {
    const router = useRouter();
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [images, setImages] = useState<File[]>([]); // New images
    const [existingImages, setExistingImages] = useState<{ id: string, image_url: string }[]>([]); // Existing images
    const [imagePreviews, setImagePreviews] = useState<string[]>([]); // Previews for NEW images
    const supabase = createClient();

    // Local state for time inputs
    const [timeState, setTimeState] = useState({ hours: 0, minutes: 0, seconds: 0 });

    const form = useForm({
        initialValues: {
            workout_type: 'running' as WorkoutType,
            workout_date: new Date(),
            distance_input: 0,
            avg_heart_rate: undefined as number | undefined,
            cadence: undefined as number | undefined,
            swolf: undefined as number | undefined,
            avg_power: undefined as number | undefined, // for cycling
            sharing_type: 'public',
            shared_group_id: null,
        },
        validate: {
            distance_input: (value) => (value > 0 ? null : '거리를 입력해주세요'),
        },
    });

    useEffect(() => {
        loadWorkout();
    }, [params.id]);

    const loadWorkout = async () => {
        try {
            const { data: userResponse } = await supabase.auth.getUser();
            const user = userResponse.user;
            if (!user) {
                router.push('/login');
                return;
            }

            const { data, error } = await supabase
                .from('workouts')
                .select('*, images:workout_images(*)')
                .eq('id', params.id)
                .single();

            if (error) throw error;
            if (data.user_id !== user.id) {
                notifications.show({ title: '오류', message: '수정 권한이 없습니다.', color: 'red' });
                router.push('/dashboard');
                return;
            }

            // Convert duration_seconds to H:M:S
            const hours = Math.floor(data.duration_seconds / 3600);
            const minutes = Math.floor((data.duration_seconds % 3600) / 60);
            const seconds = data.duration_seconds % 60;
            setTimeState({ hours, minutes, seconds });

            // Set Form Values
            let distanceInput = data.distance_meters;
            if (data.workout_type !== 'swimming') {
                distanceInput = data.distance_meters / 1000;
            }

            form.setValues({
                workout_type: data.workout_type,
                workout_date: new Date(data.workout_date),
                distance_input: distanceInput,
                avg_heart_rate: data.avg_heart_rate || undefined,
                cadence: data.cadence || undefined,
                swolf: data.swolf || undefined,
                avg_power: data.avg_power || undefined,
                sharing_type: data.sharing_type as any,
                shared_group_id: data.shared_group_id,
            });

            if (data.images) {
                setExistingImages(data.images);
            }

        } catch (error) {
            console.error('Load workout error:', error);
            notifications.show({ title: '오류', message: '운동 기록을 불러올 수 없습니다', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleImageSelect = (files: File[]) => {
        const totalImages = existingImages.length + images.length + files.length;
        if (totalImages > MAX_WORKOUT_IMAGES) {
            notifications.show({ title: '알림', message: `최대 ${MAX_WORKOUT_IMAGES}장까지만 업로드 가능합니다.`, color: 'orange' });
            return;
        }

        const newImages = [...images, ...files];
        setImages(newImages);
        const previews = newImages.map(file => URL.createObjectURL(file));
        setImagePreviews(previews);
    };

    const removeNewImage = (index: number) => {
        const newImages = images.filter((_, i) => i !== index);
        const newPreviews = imagePreviews.filter((_, i) => i !== index);
        setImages(newImages);
        setImagePreviews(newPreviews);
    };

    const removeExistingImage = async (imageId: string) => {
        try {
            await supabase.from('workout_images').delete().eq('id', imageId);
            setExistingImages(prev => prev.filter(img => img.id !== imageId));
            notifications.show({ title: '삭제됨', message: '이미지가 삭제되었습니다.', color: 'blue' });
        } catch (error) {
            console.error('Delete image error:', error);
            notifications.show({ title: '오류', message: '이미지 삭제 실패', color: 'red' });
        }
    };

    const handleSubmit = async (values: typeof form.values) => {
        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('로그인이 필요합니다.');

            const durationSeconds = (timeState.hours * 3600) + (timeState.minutes * 60) + timeState.seconds;
            if (durationSeconds <= 0) {
                throw new Error('운동 시간을 입력해주세요.');
            }

            let distanceMeters = values.distance_input;
            if (values.workout_type !== 'swimming') {
                distanceMeters = Math.round(values.distance_input * 1000);
            }

            const payload = {
                workout_type: values.workout_type,
                workout_date: new Date(values.workout_date).toISOString().split('T')[0],
                duration_seconds: durationSeconds,
                distance_meters: distanceMeters,
                avg_heart_rate: values.avg_heart_rate || null,
                cadence: values.cadence || null,
                swolf: values.swolf || null,
                avg_power: values.avg_power || null,
                sharing_type: values.sharing_type,
                shared_group_id: values.shared_group_id || null,
            };

            const { error: updateError } = await supabase
                .from('workouts')
                .update(payload)
                .eq('id', params.id);

            if (updateError) throw updateError;

            // Upload NEW images
            if (images.length > 0) {
                for (const image of images) {
                    const fileExt = image.name.split('.').pop();
                    const fileName = `${user.id}/${params.id}/${Date.now()}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage
                        .from('workout-images')
                        .upload(fileName, image);
                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('workout-images')
                        .getPublicUrl(fileName);

                    await supabase.from('workout_images').insert({
                        workout_id: params.id as string,
                        image_url: publicUrl,
                    });
                }
            }

            notifications.show({ title: '성공', message: '운동 기록이 수정되었습니다', color: 'green' });
            router.push(`/dashboard/workouts/${params.id}`);
        } catch (error: any) {
            console.error('Update workout error:', error);
            notifications.show({ title: '오류', message: error.message || '수정 실패', color: 'red' });
        } finally {
            setSubmitting(false);
        }
    };

    const isSwimming = form.values.workout_type === 'swimming';
    const isCycling = form.values.workout_type === 'cycling';
    const isRunning = form.values.workout_type === 'running';
    const distanceUnit = isSwimming ? 'm' : 'km';
    const showCadence = isRunning || isCycling;
    const showSwolf = isSwimming;
    const showPower = isCycling;

    if (loading) return <Center h={400}><Loader /></Center>;

    return (
        <Container size="md">
            <Title order={2} mb="md">기록 수정하기</Title>
            <Paper withBorder shadow="sm" p="lg">
                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack>
                        <Select
                            label="운동 종목"
                            required
                            data={WORKOUT_TYPES}
                            {...form.getInputProps('workout_type')}
                        />
                        <DatePickerInput
                            label="운동 일자"
                            required
                            {...form.getInputProps('workout_date')}
                        />
                        <Grid>
                            <Grid.Col span={12}>
                                <Text size="sm" fw={500} mb={4}>운동 시간 (필수)</Text>
                                <Group gap="xs" grow>
                                    <NumberInput placeholder="시" suffix="시간" min={0} value={timeState.hours} onChange={(v) => setTimeState(p => ({ ...p, hours: Number(v) }))} allowNegative={false} />
                                    <NumberInput placeholder="분" suffix="분" min={0} max={59} value={timeState.minutes} onChange={(v) => setTimeState(p => ({ ...p, minutes: Number(v) }))} allowNegative={false} />
                                    <NumberInput placeholder="초" suffix="초" min={0} max={59} value={timeState.seconds} onChange={(v) => setTimeState(p => ({ ...p, seconds: Number(v) }))} allowNegative={false} />
                                </Group>
                            </Grid.Col>
                        </Grid>

                        <Grid>
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                                <NumberInput
                                    label={`거리 (${distanceUnit})`}
                                    required
                                    min={0}
                                    step={isSwimming ? 10 : 0.1}
                                    decimalScale={isSwimming ? 0 : 2}
                                    {...form.getInputProps('distance_input')}
                                />
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                                <NumberInput
                                    label="평균 심박수 (bpm) (선택)"
                                    min={0}
                                    max={250}
                                    {...form.getInputProps('avg_heart_rate')}
                                />
                            </Grid.Col>
                        </Grid>

                        {showCadence && (
                            <NumberInput
                                label={isCycling ? "평균 케이던스 (rpm) (선택)" : "케이던스 (spm) (선택)"}
                                min={0}
                                {...form.getInputProps('cadence')}
                            />
                        )}

                        {showPower && (
                            <NumberInput
                                label="평균 파워 (W) (선택)"
                                min={0}
                                {...form.getInputProps('avg_power')}
                            />
                        )}

                        {showSwolf && (
                            <NumberInput
                                label="SWOLF (선택)"
                                min={0}
                                {...form.getInputProps('swolf')}
                            />
                        )}

                        <Select
                            label="공유 설정"
                            required
                            data={SHARING_TYPES}
                            {...form.getInputProps('sharing_type')}
                        />

                        <div>
                            <Text size="sm" fw={500} mb="xs">이미지 관리</Text>

                            {/* Existing Images */}
                            {existingImages.length > 0 && (
                                <Grid mb="md">
                                    {existingImages.map((img) => (
                                        <Grid.Col key={img.id} span={{ base: 6, sm: 4 }}>
                                            <div style={{ position: 'relative' }}>
                                                <Image src={img.image_url} alt="Existing" radius="md" />
                                                <ActionIcon
                                                    color="red"
                                                    variant="filled"
                                                    style={{ position: 'absolute', top: 5, right: 5 }}
                                                    onClick={() => removeExistingImage(img.id)}
                                                >
                                                    <IconX size={16} />
                                                </ActionIcon>
                                            </div>
                                        </Grid.Col>
                                    ))}
                                </Grid>
                            )}

                            {/* New Images */}
                            <FileButton
                                onChange={handleImageSelect}
                                accept="image/*"
                                multiple
                                disabled={existingImages.length + images.length >= MAX_WORKOUT_IMAGES}
                            >
                                {(props) => (
                                    <Button
                                        {...props}
                                        variant="light"
                                        leftSection={<IconUpload size={16} />}
                                        disabled={existingImages.length + images.length >= MAX_WORKOUT_IMAGES}
                                    >
                                        추가 사진 업로드
                                    </Button>
                                )}
                            </FileButton>

                            {imagePreviews.length > 0 && (
                                <Grid mt="md">
                                    {imagePreviews.map((preview, index) => (
                                        <Grid.Col key={index} span={{ base: 6, sm: 4 }}>
                                            <div style={{ position: 'relative' }}>
                                                <Image src={preview} alt="New Preview" radius="md" />
                                                <ActionIcon
                                                    color="red"
                                                    variant="filled"
                                                    style={{ position: 'absolute', top: 5, right: 5 }}
                                                    onClick={() => removeNewImage(index)}
                                                >
                                                    <IconX size={16} />
                                                </ActionIcon>
                                            </div>
                                        </Grid.Col>
                                    ))}
                                </Grid>
                            )}
                        </div>

                        <Group justify="flex-end" mt="md">
                            <Button variant="subtle" onClick={() => router.back()}>취소</Button>
                            <Button type="submit" loading={submitting}>수정 완료</Button>
                        </Group>
                    </Stack>
                </form>
            </Paper>
        </Container>
    );
}
