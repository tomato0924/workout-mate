'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX, IconUpload, IconWand, IconAlertCircle } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { WORKOUT_TYPES, SHARING_TYPES, MAX_WORKOUT_IMAGES } from '@/lib/utils/constants';
import type { WorkoutType } from '@/types';
import dayjs from 'dayjs';

function NewWorkoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const defaultType = searchParams.get('type') as WorkoutType || 'running';

    const [loading, setLoading] = useState(false);
    const [analyzingImgIndex, setAnalyzingImgIndex] = useState<number | null>(null);
    const [aiDataFilled, setAiDataFilled] = useState(false);
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const supabase = createClient();

    // Local state for time inputs (H:M:S) to calculate total seconds later
    // We use granular state here instead of one form field for easier UI handling
    const [timeState, setTimeState] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const imageSectionRef = useRef<HTMLDivElement>(null);

    const form = useForm({
        initialValues: {
            workout_type: defaultType,
            workout_date: new Date(),
            distance_input: 0, // This is either km or m based on type
            avg_heart_rate: undefined as number | undefined,
            cadence: undefined as number | undefined,
            swolf: undefined as number | undefined,
            sharing_type: 'public',
            shared_group_id: null,
        },
        validate: {
            distance_input: (value) => (value > 0 ? null : '거리를 입력해주세요'),
        },
    });

    // Reset fields when type changes
    useEffect(() => {
        // Optional: Reset specific fields if needed when type changes
        // For now we keep distance input but user might need to adjust value
        form.setFieldValue('workout_type', defaultType);
    }, [defaultType]);

    const handleImageSelect = (files: File[]) => {
        const newImages = [...images, ...files].slice(0, MAX_WORKOUT_IMAGES);
        setImages(newImages);
        const previews = newImages.map(file => URL.createObjectURL(file));
        setImagePreviews(previews);

        // Scroll to image section to show AI button
        setTimeout(() => {
            imageSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const removeImage = (index: number) => {
        const newImages = images.filter((_, i) => i !== index);
        const newPreviews = imagePreviews.filter((_, i) => i !== index);
        setImages(newImages);
        setImagePreviews(newPreviews);
    };

    const handleAnalyzeImage = async (file: File, index: number) => {
        setAnalyzingImgIndex(index);
        setAiDataFilled(false);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/analyze-workout-image', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();

            // Auto-fill form
            if (data.workout_type) form.setFieldValue('workout_type', data.workout_type);
            if (data.workout_date) form.setFieldValue('workout_date', new Date(data.workout_date));
            if (data.distance) {
                // Check unit and convert if roughly needed, usually API returns number and unit
                // For simplicity here, assume API returns 'km' for non-swim and 'm' for swim if possible
                // Adjusted logic based on creating consistent UX
                form.setFieldValue('distance_input', data.distance);
            }
            if (data.avg_heart_rate) form.setFieldValue('avg_heart_rate', data.avg_heart_rate);
            if (data.cadence) form.setFieldValue('cadence', data.cadence);
            if (data.swolf) form.setFieldValue('swolf', data.swolf);

            // Parse Duration
            if (data.duration) {
                // expected "1:30:00" or "45:00"
                const parts = data.duration.split(':').map(Number);
                let h = 0, m = 0, s = 0;
                if (parts.length === 3) {
                    [h, m, s] = parts;
                } else if (parts.length === 2) {
                    [m, s] = parts;
                }
                setTimeState({ hours: h, minutes: m, seconds: s });
            }

            setAiDataFilled(true);
            notifications.show({ title: '분석 완료', message: '이미지에서 데이터를 추출했습니다. 내용을 확인해주세요.', color: 'blue' });
            // Scroll to top to show alert
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error: any) {
            console.error(error);
            const msg = error.message || '이미지 분석에 실패했습니다.';
            notifications.show({ title: '분석 실패', message: msg, color: 'red' });
        } finally {
            setAnalyzingImgIndex(null);
        }
    };

    const handleSubmit = async (values: typeof form.values) => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('로그인이 필요합니다.');

            // Calculate duration in seconds
            const durationSeconds = (timeState.hours * 3600) + (timeState.minutes * 60) + timeState.seconds;
            if (durationSeconds <= 0) {
                throw new Error('운동 시간을 입력해주세요.');
            }

            // Calculate distance in meters
            // Swimming: input is meters. Others: input is km -> convert to meters.
            let distanceMeters = values.distance_input;
            if (values.workout_type !== 'swimming') {
                distanceMeters = Math.round(values.distance_input * 1000);
            }

            const payload = {
                user_id: user.id,
                workout_type: values.workout_type,
                // Fix: Use dayjs to format date as YYYY-MM-DD in local time to avoid timezone shifts
                workout_date: dayjs(values.workout_date).format('YYYY-MM-DD'),
                duration_seconds: durationSeconds,
                distance_meters: distanceMeters,
                avg_heart_rate: values.avg_heart_rate || null,
                cadence: values.cadence || null,  // Clean inputs
                swolf: values.swolf || null,      // Clean inputs
                sharing_type: values.sharing_type,
                shared_group_id: values.shared_group_id || null,
            };

            // Insert workout
            const { data: workout, error: workoutError } = await supabase
                .from('workouts')
                .insert(payload)
                .select()
                .single();

            if (workoutError) throw workoutError;

            // Upload images
            if (images.length > 0) {
                for (const image of images) {
                    const fileExt = image.name.split('.').pop();
                    const fileName = `${user.id}/${workout.id}/${Date.now()}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage
                        .from('workout-images')
                        .upload(fileName, image);
                    if (uploadError) throw uploadError;
                    const { data: { publicUrl } } = supabase.storage
                        .from('workout-images')
                        .getPublicUrl(fileName);
                    await supabase.from('workout_images').insert({
                        workout_id: workout.id,
                        image_url: publicUrl,
                    });
                }
            }

            notifications.show({ title: '성공', message: '운동 기록이 저장되었습니다', color: 'green' });
            router.push('/dashboard');
        } catch (error: any) {
            console.error('Create workout error:', error);
            let errorMessage = '운동 기록 저장에 실패했습니다';
            if (error.code === '42501') errorMessage = '저장 권한이 없습니다. 승인된 사용자만 기록할 수 있습니다.';
            else if (error.message) errorMessage = error.message;
            notifications.show({ title: '오류', message: errorMessage, color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const isSwimming = form.values.workout_type === 'swimming';
    const distanceUnit = isSwimming ? 'm' : 'km';
    const showCadence = form.values.workout_type === 'running';
    const showSwolf = isSwimming;

    return (
        <Paper withBorder shadow="sm" p="lg">
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack>
                    {/* Image Upload Section - Moved to Top */}
                    <div>
                        <Group align="baseline" mb="xs">
                            <Text size="sm" fw={500}>
                                운동 인증 사진 (최대 {MAX_WORKOUT_IMAGES}장)
                            </Text>
                            <Text size="xs" c="dimmed">
                                💡 이미지 업로드 후 "AI 데이터 추출" 버튼으로 자동 입력 가능
                            </Text>
                        </Group>
                        <FileButton
                            onChange={handleImageSelect}
                            accept="image/*"
                            multiple
                            disabled={images.length >= MAX_WORKOUT_IMAGES}
                        >
                            {(props) => (
                                <Button
                                    {...props}
                                    variant="light"
                                    leftSection={<IconUpload size={16} />}
                                    disabled={images.length >= MAX_WORKOUT_IMAGES}
                                >
                                    사진 추가
                                </Button>
                            )}
                        </FileButton>
                        <Text size="xs" c="dimmed" mt="xs">
                            {images.length} / {MAX_WORKOUT_IMAGES} 장 선택됨
                        </Text>
                    </div>

                    {imagePreviews.length > 0 && (
                        <div ref={imageSectionRef}>
                            <Grid>
                                {imagePreviews.map((preview, index) => (
                                    <Grid.Col key={index} span={{ base: 12, sm: 6, md: 4 }}>
                                        <div style={{ position: 'relative' }}>
                                            <Image src={preview} alt={`Preview ${index + 1}`} />
                                            <ActionIcon
                                                color="red"
                                                variant="filled"
                                                style={{ position: 'absolute', top: 5, right: 5 }}
                                                onClick={() => removeImage(index)}
                                            >
                                                <IconX size={16} />
                                            </ActionIcon>

                                            {/* AI Analyze Button */}
                                            <Button
                                                size="xs"
                                                variant="light"
                                                color="grape"
                                                fullWidth
                                                mt={4}
                                                leftSection={<IconWand size={14} />}
                                                loading={analyzingImgIndex === index}
                                                onClick={() => handleAnalyzeImage(images[index], index)}
                                            >
                                                AI 데이터 추출
                                            </Button>
                                        </div>
                                    </Grid.Col>
                                ))}
                            </Grid>
                        </div>
                    )}

                    {aiDataFilled && (
                        <Alert variant="light" color="yellow" title="AI 데이터 자동 입력" icon={<IconAlertCircle />}>
                            AI가 이미지에서 데이터를 추출하여 입력했습니다. 저장하기 전에 내용이 정확한지 반드시 확인해주세요.
                        </Alert>
                    )}

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
                                <NumberInput
                                    placeholder="시"
                                    suffix="시간"
                                    min={0}
                                    value={timeState.hours}
                                    onChange={(v) => setTimeState(p => ({ ...p, hours: Number(v) }))}
                                    allowNegative={false}
                                />
                                <NumberInput
                                    placeholder="분"
                                    suffix="분"
                                    min={0}
                                    max={59}
                                    value={timeState.minutes}
                                    onChange={(v) => setTimeState(p => ({ ...p, minutes: Number(v) }))}
                                    allowNegative={false}
                                />
                                <NumberInput
                                    placeholder="초"
                                    suffix="초"
                                    min={0}
                                    max={59}
                                    value={timeState.seconds}
                                    onChange={(v) => setTimeState(p => ({ ...p, seconds: Number(v) }))}
                                    allowNegative={false}
                                />
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
                            label="케이던스 (선택)"
                            min={0}
                            {...form.getInputProps('cadence')}
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

                    <Group justify="flex-end" mt="md">
                        <Button variant="subtle" onClick={() => router.back()}>
                            취소
                        </Button>
                        <Button type="submit" loading={loading}>
                            저장
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Paper>
    );
}

export default function NewWorkoutPage() {
    return (
        <Container size="md">
            <Title order={2} mb="md">운동 기록하기</Title>
            <Suspense fallback={<div>Loading...</div>}>
                <NewWorkoutContent />
            </Suspense>
        </Container>
    );
}
