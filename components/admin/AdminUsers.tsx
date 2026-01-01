'use client';

import { useEffect, useState } from 'react';
import {
    Table,
    Button,
    Badge,
    Group,
    Text,
    TextInput,
    Select,
    ActionIcon,
    Menu,
    Paper,
    Stack,
    LoadingOverlay,
    SimpleGrid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconDots, IconCheck, IconX, IconTrash } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/types';
import dayjs from 'dayjs';

export function AdminUsers() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string | null>('all');
    const supabase = createClient();

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setUsers(data);
        } catch (error) {
            console.error('Error loading users:', error);
            notifications.show({ title: '오류', message: '사용자 목록을 불러오지 못했습니다', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleApproval = async (userId: string, status: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ approval_status: status })
                .eq('id', userId);

            if (error) throw error;

            notifications.show({
                message: `사용자가 ${status === 'approved' ? '승인' : '거절'}되었습니다`,
                color: status === 'approved' ? 'green' : 'red',
            });
            loadUsers();
        } catch (error) {
            // ... error handling
            notifications.show({ message: '처리 실패', color: 'red' });
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('정말로 이 사용자를 삭제(탈퇴 처리)하시겠습니까? 복구할 수 없습니다.')) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '삭제 실패');
            }

            notifications.show({ message: '사용자가 삭제되었습니다', color: 'blue' });
            loadUsers();
        } catch (error: any) {
            console.error('Delete error:', error);
            notifications.show({
                title: '삭제 실패',
                message: error.message || '권한이 부족하거나 삭제할 수 없는 사용자입니다.',
                color: 'red'
            });
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase()) ||
            user.nickname.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = filterStatus === 'all' || user.approval_status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <Stack gap="md">
            <Paper shadow="sm" radius="md" p="md" withBorder>
                <Stack gap="md">
                    <Group justify="space-between">
                        <Text size="lg" fw={700}>사용자 목록</Text>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                        <TextInput
                            placeholder="이름, 닉네임, 이메일 검색"
                            leftSection={<IconSearch size={16} />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Select
                            value={filterStatus}
                            onChange={setFilterStatus}
                            data={[
                                { value: 'all', label: '전체 상태' },
                                { value: 'pending', label: '승인 대기' },
                                { value: 'approved', label: '승인됨' },
                                { value: 'rejected', label: '거절됨' },
                            ]}
                        />
                    </SimpleGrid>
                </Stack>
            </Paper>

            <Paper withBorder style={{ position: 'relative', minHeight: 200 }}>
                <LoadingOverlay visible={loading} />
                <Table striped highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>가입일</Table.Th>
                            <Table.Th>이름 (닉네임)</Table.Th>
                            <Table.Th>이메일</Table.Th>
                            <Table.Th>연락처</Table.Th>
                            <Table.Th>권한</Table.Th>
                            <Table.Th>상태</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>관리</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {filteredUsers.length === 0 ? (
                            <Table.Tr>
                                <Table.Td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>
                                    <Text c="dimmed">데이터가 없습니다</Text>
                                </Table.Td>
                            </Table.Tr>
                        ) : filteredUsers.map((user) => (
                            <Table.Tr key={user.id}>
                                <Table.Td>{dayjs(user.created_at).format('YYYY-MM-DD')}</Table.Td>
                                <Table.Td>
                                    <Text size="sm" fw={500}>{user.name}</Text>
                                    <Text size="xs" c="dimmed">{user.nickname}</Text>
                                </Table.Td>
                                <Table.Td>{user.email}</Table.Td>
                                <Table.Td>{user.phone}</Table.Td>
                                <Table.Td>
                                    <Badge
                                        color={user.role === 'super_admin' ? 'red' : user.role === 'admin' ? 'orange' : 'gray'}
                                        variant="light"
                                    >
                                        {user.role}
                                    </Badge>
                                </Table.Td>
                                <Table.Td>
                                    <Badge
                                        color={user.approval_status === 'approved' ? 'green' : user.approval_status === 'pending' ? 'yellow' : 'red'}
                                    >
                                        {user.approval_status}
                                    </Badge>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                    <Menu shadow="md" width={200} position="bottom-end">
                                        <Menu.Target>
                                            <ActionIcon variant="subtle" color="gray">
                                                <IconDots size={16} />
                                            </ActionIcon>
                                        </Menu.Target>
                                        <Menu.Dropdown>
                                            {user.approval_status === 'pending' && (
                                                <>
                                                    <Menu.Item
                                                        leftSection={<IconCheck size={14} />}
                                                        color="green"
                                                        onClick={() => handleApproval(user.id, 'approved')}
                                                    >
                                                        가입 승인
                                                    </Menu.Item>
                                                    <Menu.Item
                                                        leftSection={<IconX size={14} />}
                                                        color="red"
                                                        onClick={() => handleApproval(user.id, 'rejected')}
                                                    >
                                                        가입 거절
                                                    </Menu.Item>
                                                    <Menu.Divider />
                                                </>
                                            )}
                                            <Menu.Item
                                                leftSection={<IconTrash size={14} />}
                                                color="red"
                                                onClick={() => handleDelete(user.id)}
                                            >
                                                사용자 삭제 (탈퇴)
                                            </Menu.Item>
                                        </Menu.Dropdown>
                                    </Menu>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Paper>
        </Stack>
    );
}
