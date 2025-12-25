'use client';

import { useEffect, useState } from 'react';
import { Container, Title, Paper, Stack, Text, Group, Avatar, Badge, Button } from '@mantine/core';
import { IconMail, IconPhone, IconShieldCheck } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/types';

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const supabase = createClient();

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (data) setProfile(data);
    };

    const getRoleBadge = (role: string) => {
        const badges: Record<string, { color: string; label: string }> = {
            super_admin: { color: 'red', label: '슈퍼 관리자' },
            admin: { color: 'orange', label: '관리자' },
            user: { color: 'blue', label: '사용자' },
        };
        return badges[role] || badges.user;
    };

    if (!profile) return null;

    const roleBadge = getRoleBadge(profile.role);

    return (
        <Container size="sm">
            <Title order={2} mb="md">프로필</Title>

            <Paper withBorder shadow="sm" p="lg">
                <Stack align="center" mb="lg">
                    <Avatar size={100} radius={100} color="blue">
                        {profile.nickname.charAt(0).toUpperCase()}
                    </Avatar>
                    <div style={{ textAlign: 'center' }}>
                        <Title order={3}>{profile.nickname}</Title>
                        <Text c="dimmed" size="sm">{profile.name}</Text>
                    </div>
                    <Badge color={roleBadge.color} leftSection={<IconShieldCheck size={12} />}>
                        {roleBadge.label}
                    </Badge>
                </Stack>

                <Stack gap="md">
                    <Group>
                        <IconMail size={20} />
                        <div>
                            <Text size="xs" c="dimmed">이메일</Text>
                            <Text>{profile.email}</Text>
                        </div>
                    </Group>

                    <Group>
                        <IconPhone size={20} />
                        <div>
                            <Text size="xs" c="dimmed">연락처</Text>
                            <Text>{profile.phone}</Text>
                        </div>
                    </Group>

                    <Text size="xs" c="dimmed">
                        가입일: {new Date(profile.created_at).toLocaleDateString('ko-KR')}
                    </Text>
                </Stack>
            </Paper>
        </Container>
    );
}
