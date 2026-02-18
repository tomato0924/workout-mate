'use client';

import { useEffect, useState } from 'react';
import { Modal, Text, Stack, Button, Group, Title, Divider, ScrollArea } from '@mantine/core';
import { IconSpeakerphone } from '@tabler/icons-react';
import type { Announcement } from '@/types';

export function AnnouncementPopup() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [opened, setOpened] = useState(false);

    useEffect(() => {
        loadAnnouncements();
    }, []);

    const loadAnnouncements = async () => {
        try {
            const res = await fetch('/api/admin/announcements');
            if (!res.ok) return;
            const data = await res.json();
            if (data.announcements && data.announcements.length > 0) {
                setAnnouncements(data.announcements);
                setCurrentIndex(0);
                setOpened(true);
            }
        } catch (error) {
            console.error('Failed to load announcements:', error);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            await fetch(`/api/admin/announcements/${id}/read`, { method: 'POST' });
        } catch {
            // silently fail
        }
    };

    const handleClose = () => {
        // Mark current announcement as read
        if (announcements[currentIndex]) {
            markAsRead(announcements[currentIndex].id);
        }

        // Show next announcement if available
        if (currentIndex < announcements.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setOpened(false);
        }
    };

    const handleCloseAll = () => {
        // Mark all remaining as read
        announcements.slice(currentIndex).forEach(a => markAsRead(a.id));
        setOpened(false);
    };

    if (announcements.length === 0) return null;

    const current = announcements[currentIndex];
    if (!current) return null;

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title={
                <Group gap="xs">
                    <IconSpeakerphone size={20} color="#228be6" />
                    <Text fw={700} size="lg">공지사항</Text>
                    {announcements.length > 1 && (
                        <Text size="xs" c="dimmed">({currentIndex + 1}/{announcements.length})</Text>
                    )}
                </Group>
            }
            size="md"
            centered
            overlayProps={{ backgroundOpacity: 0.4, blur: 3 }}
            radius="lg"
            styles={{
                header: { borderBottom: '1px solid var(--mantine-color-gray-2)', paddingBottom: 12 },
                body: { padding: '20px 24px' },
            }}
        >
            <Stack>
                <Title order={4} c="blue.7">{current.title}</Title>
                <Divider />
                <ScrollArea.Autosize mah={400}>
                    <Text
                        size="sm"
                        style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
                    >
                        {current.content}
                    </Text>
                </ScrollArea.Autosize>
                <Divider />
                <Text size="xs" c="dimmed" ta="right">
                    {new Date(current.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </Text>
                <Group justify="flex-end" mt="xs">
                    {announcements.length > 1 && currentIndex < announcements.length - 1 && (
                        <Button variant="subtle" size="sm" onClick={handleCloseAll}>
                            모두 닫기
                        </Button>
                    )}
                    <Button onClick={handleClose} size="sm">
                        {currentIndex < announcements.length - 1 ? '다음 공지' : '확인'}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
