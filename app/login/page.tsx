'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    TextInput,
    PasswordInput,
    Button,
    Paper,
    Title,
    Container,
    Stack,
    Anchor,
    Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const form = useForm({
        initialValues: {
            email: '',
            password: '',
        },
        validate: {
            email: (value) => (/^\S+@\S+$/.test(value) ? null : '올바른 이메일을 입력해주세요'),
            password: (value) => (value.length >= 6 ? null : '비밀번호는 최소 6자 이상이어야 합니다'),
        },
    });

    const handleSubmit = async (values: typeof form.values) => {
        setLoading(true);
        try {
            // Sign in with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: values.email,
                password: values.password,
            });

            if (authError) {
                notifications.show({
                    title: '로그인 실패',
                    message: '이메일 또는 비밀번호가 올바르지 않습니다',
                    color: 'red',
                });
                setLoading(false);
                return;
            }

            // Check user profile and approval status
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (profileError || !profile) {
                notifications.show({
                    title: '오류',
                    message: '사용자 프로필을 불러올 수 없습니다',
                    color: 'red',
                });
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            // Check approval status
            if (profile.approval_status === 'pending') {
                router.push('/pending-approval');
            } else if (profile.approval_status === 'approved') {
                router.push('/dashboard');
            } else {
                notifications.show({
                    title: '계정 거절됨',
                    message: '귀하의 계정은 관리자에 의해 거절되었습니다',
                    color: 'red',
                });
                await supabase.auth.signOut();
            }
        } catch (error) {
            console.error('Login error:', error);
            notifications.show({
                title: '오류',
                message: '로그인 중 오류가 발생했습니다',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container size={420} my={100}>
            <Title ta="center" mb="md">
                🏃‍♂️ Workout Mate
            </Title>
            <Text c="dimmed" size="sm" ta="center" mb={30}>
                친구들과 함께하는 운동 기록
            </Text>

            <Paper withBorder shadow="md" p={30} radius="md">
                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack>
                        <TextInput
                            label="이메일"
                            placeholder="your@email.com"
                            required
                            {...form.getInputProps('email')}
                        />

                        <PasswordInput
                            label="비밀번호"
                            placeholder="비밀번호를 입력하세요"
                            required
                            {...form.getInputProps('password')}
                        />

                        <Button type="submit" fullWidth loading={loading}>
                            로그인
                        </Button>

                        <Text ta="center" mt="md">
                            계정이 없으신가요?{' '}
                            <Anchor href="/signup" size="sm">
                                회원가입
                            </Anchor>
                        </Text>
                    </Stack>
                </form>
            </Paper>
        </Container>
    );
}
