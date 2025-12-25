'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AppShell, Burger, Group, Title, NavLink, Avatar, Menu, ActionIcon, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
    IconHome,
    IconUsers,
    IconUser,
    IconShieldCheck,
    IconLogout,
    IconRun,
} from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/types';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [opened, { toggle, close }] = useDisclosure();
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

    const handleNavigation = (path: string) => {
        router.push(path);
        close();
    };

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: 250,
                breakpoint: 'sm',
                collapsed: { mobile: !opened },
            }}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Group>
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                        <IconRun size={28} />
                        <Title order={3}>Workout Mate</Title>
                    </Group>

                    {profile && (
                        <Menu shadow="md" width={200}>
                            <Menu.Target>
                                <ActionIcon variant="subtle" size="lg">
                                    <Avatar size="sm" radius="xl" color="blue">
                                        {profile.nickname.charAt(0).toUpperCase()}
                                    </Avatar>
                                </ActionIcon>
                            </Menu.Target>

                            <Menu.Dropdown>
                                <Menu.Label>{profile.nickname}</Menu.Label>
                                <Menu.Item leftSection={<IconUser size={14} />} onClick={() => handleNavigation('/dashboard/profile')}>
                                    프로필
                                </Menu.Item>
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
            </AppShell.Header>

            <AppShell.Navbar p="md">
                <NavLink
                    label="대시보드"
                    leftSection={<IconHome size={20} />}
                    onClick={() => handleNavigation('/dashboard')}
                    active={pathname === '/dashboard'}
                />
                <NavLink
                    label="운동 기록"
                    leftSection={<IconRun size={20} />}
                    onClick={() => handleNavigation('/dashboard/workouts/new')}
                />
                <NavLink
                    label="그룹"
                    leftSection={<IconUsers size={20} />}
                    onClick={() => handleNavigation('/dashboard/groups')}
                    active={pathname.startsWith('/dashboard/groups')}
                />
                <NavLink
                    label="프로필"
                    leftSection={<IconUser size={20} />}
                    onClick={() => handleNavigation('/dashboard/profile')}
                    active={pathname === '/dashboard/profile'}
                />

                {isAdmin && (
                    <>
                        <NavLink
                            label="관리자"
                            leftSection={<IconShieldCheck size={20} />}
                            onClick={() => handleNavigation('/dashboard/admin')}
                            active={pathname.startsWith('/dashboard/admin')}
                            mt="md"
                        />
                    </>
                )}
            </AppShell.Navbar>

            <AppShell.Main>{children}</AppShell.Main>
        </AppShell>
    );
}
