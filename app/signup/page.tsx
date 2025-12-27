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

export default function SignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const form = useForm({
        initialValues: {
            email: '',
            password: '',
            confirmPassword: '',
            name: '',
            nickname: '',
            phone: '',
        },
        validate: {
            email: (value) => (/^\S+@\S+$/.test(value) ? null : '올바른 이메일을 입력해주세요'),
            password: (value) => (value.length >= 6 ? null : '비밀번호는 최소 6자 이상이어야 합니다'),
            confirmPassword: (value, values) =>
                value === values.password ? null : '비밀번호가 일치하지 않습니다',
            name: (value) => (value.trim().length > 0 ? null : '이름을 입력해주세요'),
            nickname: (value) => (value.trim().length > 0 ? null : '닉네임을 입력해주세요'),
            phone: (value) => (value.trim().length > 0 ? null : '연락처를 입력해주세요'),
        },
    });

    const handleSubmit = async (values: typeof form.values) => {
        setLoading(true);
        try {
            // Step 1: Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: values.email,
                password: values.password,
            });

            if (authError) {
                notifications.show({
                    title: '회원가입 실패',
                    message: authError.message,
                    color: 'red',
                });
                setLoading(false);
                return;
            }

            if (!authData.user) {
                notifications.show({
                    title: '오류',
                    message: '사용자 생성에 실패했습니다',
                    color: 'red',
                });
                setLoading(false);
                return;
            }

            // Step 2: Check if this is the first user
            const { count } = await supabase
                .from('user_profiles')
                .select('*', { count: 'exact', head: true });

            const isFirstUser = count === 0;

            // Step 3: Create user profile
            const { error: profileError } = await supabase.from('user_profiles').insert({
                id: authData.user.id,
                email: values.email,
                name: '', // Removed from UI
                nickname: values.nickname,
                phone: '', // Removed from UI
                role: isFirstUser ? 'super_admin' : 'user',
                approval_status: isFirstUser ? 'approved' : 'pending',
            });

            if (profileError) {
                notifications.show({
                    title: '프로필 생성 실패',
                    message: profileError.message,
                    color: 'red',
                });
                // Clean up auth user if profile creation fails
                await supabase.auth.admin.deleteUser(authData.user.id);
                setLoading(false);
                return;
            }

            // Show success message
            if (isFirstUser) {
                notifications.show({
                    title: '환영합니다!',
                    message: '첫 번째 사용자로 슈퍼 관리자 권한이 부여되었습니다',
                    color: 'green',
                });
                router.push('/dashboard');
            } else {
                notifications.show({
                    title: '회원가입 성공',
                    message: '관리자 승인 대기 중입니다',
                    color: 'blue',
                });
                router.push('/pending-approval');
            }
        } catch (error) {
            console.error('Signup error:', error);
            notifications.show({
                title: '오류',
                message: '회원가입 중 오류가 발생했습니다',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container size={460} my={60}>
            <Title ta="center" mb="md">
                🏃‍♂️ Workout Mate
            </Title>
            <Text c="dimmed" size="sm" ta="center" mb={30}>
                회원가입
            </Text>

            <Paper withBorder shadow="md" p={30} radius="md">
                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack gap="md">
                        <TextInput
                            label="이메일"
                            placeholder="your@email.com"
                            required
                            {...form.getInputProps('email')}
                        />

                        <TextInput
                            label="닉네임"
                            placeholder="운동왕"
                            required
                            {...form.getInputProps('nickname')}
                        />

                        <PasswordInput
                            label="비밀번호"
                            placeholder="최소 6자 이상"
                            required
                            {...form.getInputProps('password')}
                        />

                        <PasswordInput
                            label="비밀번호 확인"
                            placeholder="비밀번호를 다시 입력하세요"
                            required
                            {...form.getInputProps('confirmPassword')}
                        />

                        <Button type="submit" fullWidth loading={loading} mt="md">
                            회원가입
                        </Button>

                        <Text ta="center" mt="md">
                            이미 계정이 있으신가요?{' '}
                            <Anchor href="/login" size="sm">
                                로그인
                            </Anchor>
                        </Text>
                    </Stack>
                </form>
            </Paper>
        </Container>
    );
}
