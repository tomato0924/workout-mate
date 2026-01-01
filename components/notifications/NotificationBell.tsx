'use client';

import { useState, useEffect } from 'react';
import { ActionIcon, Indicator, Popover, Text, Stack, Group, Avatar, ScrollArea, ThemeIcon, Box } from '@mantine/core';
import { IconBell, IconMessageCircle, IconHeart } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils/helpers';
import type { Notification } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';

dayjs.extend(relativeTime);
dayjs.locale('ko');

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [opened, setOpened] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        fetchNotifications();

        // Subscription for real-time updates could be added here
        // For now, let's poll every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchNotifications = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('notifications')
            .select('*, actor:user_profiles!actor_id(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching notifications:', error);
            return;
        }

        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    };

    const handleOpen = () => {
        setOpened((o) => !o);
        if (!opened && unreadCount > 0) {
            markAllAsRead();
        }
    };

    const markAllAsRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Optimistic update
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

        await supabase.rpc('mark_notifications_as_read', { target_user_id: user.id });
    };

    const handleItemClick = (notification: Notification) => {
        setOpened(false);
        router.push(`/dashboard/workouts/${notification.workout_id}`);
    };

    const getIcon = (type: string) => {
        if (type === 'reaction') return <IconHeart size={14} />;
        return <IconMessageCircle size={14} />;
    };

    const getColor = (type: string) => {
        if (type === 'reaction') return 'red';
        return 'blue';
    };

    return (
        <Popover
            opened={opened}
            onChange={setOpened}
            width={320}
            position="bottom-end"
            withArrow
            shadow="md"
        >
            <Popover.Target>
                <Indicator
                    inline
                    label={unreadCount}
                    size={16}
                    disabled={unreadCount === 0}
                    color="red"
                    offset={4}
                >
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        onClick={handleOpen}
                    >
                        <IconBell size={20} />
                    </ActionIcon>
                </Indicator>
            </Popover.Target>

            <Popover.Dropdown p={0}>
                <Box p="sm" style={{ borderBottom: '1px solid #eee' }}>
                    <Text size="sm" fw={600}>알림</Text>
                </Box>
                <ScrollArea.Autosize type="scroll" mah={350}>
                    {notifications.length === 0 ? (
                        <Box p="xl" ta="center">
                            <Text size="sm" c="dimmed">새로운 알림이 없습니다</Text>
                        </Box>
                    ) : (
                        <Stack gap={0}>
                            {notifications.map((notification) => (
                                <Box
                                    key={notification.id}
                                    p="sm"
                                    style={{
                                        cursor: 'pointer',
                                        backgroundColor: !notification.is_read ? '#f8f9fa' : 'white',
                                        borderBottom: '1px solid #f1f3f5',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onClick={() => handleItemClick(notification)}
                                >
                                    <Group align="flex-start" wrap="nowrap">
                                        <Avatar
                                            src={notification.actor?.avatar_url}
                                            radius="xl"
                                            size="md"
                                        >
                                            {notification.actor?.nickname?.charAt(0)}
                                        </Avatar>
                                        <div style={{ flex: 1 }}>
                                            <Group gap={6} mb={2}>
                                                <Text size="sm" fw={600}>
                                                    {notification.actor?.nickname}
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    님이
                                                </Text>
                                            </Group>
                                            <Text size="sm" lineClamp={2} mb={4}>
                                                {notification.type === 'reaction' ? (
                                                    <span>회원님의 운동 기록에 반응을 남겼습니다: {notification.content}</span>
                                                ) : (
                                                    <span>댓글을 남겼습니다: "{notification.content}"</span>
                                                )}
                                            </Text>
                                            <Group gap={6}>
                                                <ThemeIcon
                                                    size="xs"
                                                    color={getColor(notification.type)}
                                                    variant="transparent"
                                                >
                                                    {getIcon(notification.type)}
                                                </ThemeIcon>
                                                <Text size="xs" c="dimmed">
                                                    {dayjs(notification.created_at).fromNow()}
                                                </Text>
                                            </Group>
                                        </div>
                                    </Group>
                                </Box>
                            ))}
                        </Stack>
                    )}
                </ScrollArea.Autosize>
            </Popover.Dropdown>
        </Popover>
    );
}
