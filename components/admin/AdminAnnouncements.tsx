'use client';

import { useEffect, useState } from 'react';
import {
    Stack, Paper, Text, Group, Button, TextInput, Textarea, Switch,
    Badge, ActionIcon, Modal, Divider, LoadingOverlay, Table,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconEye, IconEyeOff } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { Announcement } from '@/types';

export function AdminAnnouncements() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formIsPopup, setFormIsPopup] = useState(false);

    useEffect(() => {
        loadAnnouncements();
    }, []);

    const loadAnnouncements = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/announcements?mode=admin');
            const data = await res.json();
            setAnnouncements(data.announcements || []);
        } catch (error) {
            console.error('Failed to load announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormTitle('');
        setFormContent('');
        setFormIsPopup(false);
        setEditing(null);
    };

    const openCreate = () => {
        resetForm();
        setModalOpen(true);
    };

    const openEdit = (announcement: Announcement) => {
        setEditing(announcement);
        setFormTitle(announcement.title);
        setFormContent(announcement.content);
        setFormIsPopup(announcement.is_popup);
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formTitle.trim() || !formContent.trim()) {
            notifications.show({ message: '제목과 내용을 입력해주세요', color: 'red' });
            return;
        }

        setSubmitting(true);
        try {
            if (editing) {
                // Update
                const res = await fetch(`/api/admin/announcements/${editing.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: formTitle,
                        content: formContent,
                        is_popup: formIsPopup,
                    }),
                });
                if (!res.ok) throw new Error('Update failed');
                notifications.show({ message: '공지사항이 수정되었습니다', color: 'green' });
            } else {
                // Create
                const res = await fetch('/api/admin/announcements', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: formTitle,
                        content: formContent,
                        is_popup: formIsPopup,
                    }),
                });
                if (!res.ok) throw new Error('Create failed');
                notifications.show({ message: '공지사항이 등록되었습니다', color: 'green' });
            }

            setModalOpen(false);
            resetForm();
            loadAnnouncements();
        } catch (error) {
            console.error('Submit error:', error);
            notifications.show({ message: '저장 실패', color: 'red' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleTogglePopup = async (announcement: Announcement) => {
        try {
            const res = await fetch(`/api/admin/announcements/${announcement.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_popup: !announcement.is_popup }),
            });
            if (!res.ok) throw new Error('Toggle failed');
            notifications.show({
                message: announcement.is_popup ? '팝업 노출이 해제되었습니다' : '팝업으로 노출됩니다',
                color: 'blue',
            });
            loadAnnouncements();
        } catch (error) {
            notifications.show({ message: '변경 실패', color: 'red' });
        }
    };

    const handleToggleActive = async (announcement: Announcement) => {
        try {
            const res = await fetch(`/api/admin/announcements/${announcement.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !announcement.is_active }),
            });
            if (!res.ok) throw new Error('Toggle failed');
            notifications.show({
                message: announcement.is_active ? '공지사항이 비활성화되었습니다' : '공지사항이 활성화되었습니다',
                color: 'blue',
            });
            loadAnnouncements();
        } catch (error) {
            notifications.show({ message: '변경 실패', color: 'red' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;

        try {
            const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            notifications.show({ message: '삭제되었습니다', color: 'green' });
            loadAnnouncements();
        } catch (error) {
            notifications.show({ message: '삭제 실패', color: 'red' });
        }
    };

    return (
        <Stack>
            <Group justify="space-between" mb="sm">
                <Text fw={600} size="lg">공지사항 관리</Text>
                <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
                    공지글 작성
                </Button>
            </Group>

            <Paper withBorder p="md" radius="md" pos="relative">
                <LoadingOverlay visible={loading} />

                {announcements.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">등록된 공지사항이 없습니다</Text>
                ) : (
                    <Table striped highlightOnHover>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>제목</Table.Th>
                                <Table.Th style={{ width: 80 }}>상태</Table.Th>
                                <Table.Th style={{ width: 80 }}>팝업</Table.Th>
                                <Table.Th style={{ width: 120 }}>작성일</Table.Th>
                                <Table.Th style={{ width: 120 }}>관리</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {announcements.map(ann => (
                                <Table.Tr key={ann.id}>
                                    <Table.Td>
                                        <Text size="sm" fw={500} lineClamp={1}>{ann.title}</Text>
                                        <Text size="xs" c="dimmed" lineClamp={1}>{ann.content.slice(0, 60)}...</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge
                                            color={ann.is_active ? 'green' : 'gray'}
                                            variant="light"
                                            size="sm"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleToggleActive(ann)}
                                        >
                                            {ann.is_active ? '활성' : '비활성'}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <ActionIcon
                                            variant={ann.is_popup ? 'filled' : 'subtle'}
                                            color={ann.is_popup ? 'blue' : 'gray'}
                                            onClick={() => handleTogglePopup(ann)}
                                            title={ann.is_popup ? '팝업 노출 중' : '팝업 미노출'}
                                        >
                                            {ann.is_popup ? <IconEye size={16} /> : <IconEyeOff size={16} />}
                                        </ActionIcon>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" c="dimmed">
                                            {new Date(ann.created_at).toLocaleDateString('ko-KR')}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(ann)}>
                                                <IconEdit size={16} />
                                            </ActionIcon>
                                            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(ann.id)}>
                                                <IconTrash size={16} />
                                            </ActionIcon>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Paper>

            {/* Create/Edit Modal */}
            <Modal
                opened={modalOpen}
                onClose={() => { setModalOpen(false); resetForm(); }}
                title={editing ? '공지사항 수정' : '공지사항 작성'}
                size="lg"
            >
                <Stack>
                    <TextInput
                        label="제목"
                        placeholder="공지사항 제목을 입력하세요"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        required
                    />
                    <Textarea
                        label="내용"
                        placeholder="공지사항 내용을 입력하세요"
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        minRows={8}
                        maxRows={15}
                        required
                    />
                    <Divider />
                    <Switch
                        label="팝업으로 노출"
                        description="체크하면 유저들이 접속할 때 이 공지를 팝업으로 보게 됩니다"
                        checked={formIsPopup}
                        onChange={(e) => setFormIsPopup(e.currentTarget.checked)}
                    />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => { setModalOpen(false); resetForm(); }}>
                            취소
                        </Button>
                        <Button onClick={handleSubmit} loading={submitting}>
                            {editing ? '수정' : '등록'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    );
}
