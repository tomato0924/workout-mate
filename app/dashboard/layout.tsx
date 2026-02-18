'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AppShell, Group, Title, Avatar, Menu, ActionIcon, Container, Button, Text, UnstyledButton } from '@mantine/core';
import {
    IconHome,
    IconUsers,
    IconUser,
    IconShieldCheck,
    IconLogout,
    IconRun,
    IconCalendarEvent,
} from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/types';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { AnnouncementPopup } from '@/components/announcements/AnnouncementPopup';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push('/login');
                return;
            }

            const { data: profileData } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!profileData) {
                router.push('/login');
                return;
            }

            if (profileData.approval_status !== 'approved') {
                router.push('/pending-approval');
                return;
            }

            setProfile(profileData);
        } catch (error) {
            console.error('Load profile error:', error);
            router.push('/login');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

    // Helper to check active state
    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path !== '/dashboard' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <AppShell
            header={{ height: 60 }}
            padding="md"
        >
            <AppShell.Header>
                <Container size="lg" h="100%">
                    <Group h="100%" justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap">
                            {/* Logo */}
                            <Link href="/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Group gap={4} wrap="nowrap">
                                    <IconRun size={28} color="#228be6" />
                                    <Title order={3} visibleFrom="xs">Workout Mate</Title>
                                </Group>
                            </Link>

                            {/* Main Navigation */}
                            <Group gap={4} ml="xs" wrap="nowrap">
                                <Button
                                    component={Link}
                                    href="/dashboard"
                                    variant={isActive('/dashboard') ? 'light' : 'subtle'}
                                    color="blue"
                                    leftSection={<IconHome size={20} />}
                                    size="sm"
                                    px="xs"
                                >
                                    <Text span visibleFrom="xs">피드</Text>
                                </Button>
                                <Button
                                    component={Link}
                                    href="/dashboard/groups"
                                    variant={isActive('/dashboard/groups') ? 'light' : 'subtle'}
                                    color="blue"
                                    leftSection={<IconUsers size={20} />}
                                    size="sm"
                                    px="xs"
                                >
                                    <Text span visibleFrom="xs">크루</Text>
                                </Button>
                                <Button
                                    component={Link}
                                    href="/dashboard/competitions"
                                    variant={isActive('/dashboard/competitions') ? 'light' : 'subtle'}
                                    color="blue"
                                    leftSection={<IconCalendarEvent size={20} />}
                                    size="sm"
                                    px="xs"
                                >
                                    <Text span visibleFrom="xs">대회일정</Text>
                                </Button>
                            </Group>
                        </Group>

                        {/* Right Section */}
                        <Group gap="xs" wrap="nowrap">
                            {/* Notification Bell */}
                            {profile && <NotificationBell />}

                            {/* User Menu */}
                            {profile && (
                                <Menu shadow="md" width={200} position="bottom-end">
                                    <Menu.Target>
                                        <UnstyledButton>
                                            <Group gap={6} wrap="nowrap">
                                                <Avatar size="md" radius="xl" color="blue" src={profile.avatar_url} name={profile.nickname}>
                                                    {profile.nickname.charAt(0).toUpperCase()}
                                                </Avatar>
                                                <Text size="sm" fw={500} visibleFrom="xs">{profile.nickname}</Text>
                                            </Group>
                                        </UnstyledButton>
                                    </Menu.Target>

                                    <Menu.Dropdown>
                                        <Menu.Label>내 계정</Menu.Label>
                                        <Menu.Item
                                            leftSection={<IconUser size={14} />}
                                            component={Link}
                                            href="/dashboard/profile"
                                        >
                                            내 정보
                                        </Menu.Item>

                                        {isAdmin && (
                                            <Menu.Item
                                                leftSection={<IconShieldCheck size={14} />}
                                                component={Link}
                                                href="/dashboard/admin"
                                                color="grape"
                                                fw={500}
                                            >
                                                관리자
                                            </Menu.Item>
                                        )}

                                        <Menu.Divider />
                                        <Menu.Item
                                            color="red"
                                            leftSection={<IconLogout size={14} />}
                                            onClick={handleLogout}
                                        >
                                            로그아웃
                                        </Menu.Item>
                                    </Menu.Dropdown>
                                </Menu>
                            )}
                        </Group>
                    </Group>
                </Container>
            </AppShell.Header>

            <AppShell.Main>
                <Container size="lg" p={0}>
                    {children}
                </Container>
                {profile && <AnnouncementPopup />}
            </AppShell.Main>
        </AppShell>
    );
}
