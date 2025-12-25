'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Paper, Title, Text, Stack, Button, Loader, Center } from '@mantine/core';
import { IconClock, IconRefresh } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/types';

export default function PendingApprovalPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        checkApprovalStatus();
    }, []);

    const checkApprovalStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            const { data: profileData, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error || !profileData) {
                console.error('Profile fetch error:', error);
                setLoading(false);
                return;
            }

            setProfile(profileData);

            // Redirect if approved
            if (profileData.approval_status === 'approved') {
                router.push('/dashboard');
            } else if (profileData.approval_status === 'rejected') {
                await supabase.auth.signOut();
                router.push('/login');
            }

            setLoading(false);
        } catch (error) {
            console.error('Check approval error:', error);
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (loading) {
        return (
            <Center h="100vh">
                <Loader size="lg" />
            </Center>
        );
    }

    return (
        <Container size={480} my={100}>
            <Paper withBorder shadow="md" p={40} radius="md">
                <Stack align="center" gap="lg">
                    <IconClock size={64} stroke={1.5} color="orange" />

                    <Title order={2} ta="center">
                        승인 대기 중
                    </Title>

                    <Text c="dimmed" ta="center">
                        {profile?.name}님, 환영합니다!
                        <br />
                        관리자가 귀하의 가입 요청을 검토하고 있습니다.
                        <br />
                        승인 후 모든 기능을 사용하실 수 있습니다.
                    </Text>

                    <Button
                        leftSection={<IconRefresh size={16} />}
                        onClick={checkApprovalStatus}
                        variant="light"
                    >
                        승인 상태 확인
                    </Button>

                    <Button onClick={handleLogout} variant="subtle" color="gray">
                        로그아웃
                    </Button>
                </Stack>
            </Paper>
        </Container>
    );
}
