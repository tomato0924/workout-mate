'use client';

import { useEffect, useState } from 'react';
import {
    Table,
    Button,
    Badge,
    Group,
    Text,
    Select,
    Paper,
    Stack,
    LoadingOverlay,
    Modal,
    TextInput,
    Textarea,
    ActionIcon,
    Menu,
    ThemeIcon,
    Avatar,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconDots, IconCheck, IconX, IconUserPlus, IconUsers } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { Group as GroupType, UserProfile } from '@/types';
import dayjs from 'dayjs';

export function AdminGroups() {
    const [groups, setGroups] = useState<GroupType[]>([]);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<UserProfile[]>([]); // For owner selection
    const supabase = createClient();

    // Modals
    const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
    const [assignOpened, { open: openAssign, close: closeAssign }] = useDisclosure(false);
    const [selectedGroup, setSelectedGroup] = useState<GroupType | null>(null);

    // Create Group Form
    const createForm = useForm({
        initialValues: {
            name: '',
            description: '',
            owner_id: '',
            invite_code: '',
        },
        validate: {
            name: (value) => (value ? null : '그룹명을 입력하세요'),
            owner_id: (value) => (value ? null : '대표자를 선택하세요'),
            invite_code: (value) => (value ? null : '초대 코드를 입력하세요'),
        },
    });

    useEffect(() => {
        loadGroups();
        loadUsers();
    }, []);

    const loadGroups = async () => {
        setLoading(true);
        try {
            // Also fetch member count roughly
            // Supabase basic client doesn't support easy count aggregations inside select without RPC or complex query
            // We will fetch pure groups + owner first.
            const { data, error } = await supabase
                .from('groups')
                .select('*, owner:user_profiles(*)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setGroups(data);
        } catch (error) {
            console.error(error);
            notifications.show({ message: '그룹 로드 실패', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        const { data } = await supabase.from('user_profiles').select('*').eq('approval_status', 'approved');
        if (data) setUsers(data);
    };

    const handleApproval = async (groupId: string, status: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase.from('groups').update({ approval_status: status }).eq('id', groupId);
            if (error) throw error;
            notifications.show({ message: `그룹이 ${status === 'approved' ? '승인' : '거절'}되었습니다`, color: 'green' });
            loadGroups();
        } catch (error) {
            notifications.show({ message: '처리 중 오류', color: 'red' });
        }
    };

    const handleCreateGroup = async (values: typeof createForm.values) => {
        try {
            const { error } = await supabase.from('groups').insert({
                name: values.name,
                description: values.description,
                owner_id: values.owner_id,
                invite_code: values.invite_code,
                approval_status: 'approved', // Admin created groups are auto-approved
            });

            if (error) throw error;
            notifications.show({ message: '그룹이 생성되었습니다', color: 'green' });
            closeCreate();
            createForm.reset();
            loadGroups();
        } catch (error: any) {
            notifications.show({ message: error.message || '생성 실패', color: 'red' });
        }
    };

    // Assign Leader Logic (Actually Update Owner)
    const [newOwnerId, setNewOwnerId] = useState<string | null>(null);
    const handleUpdateOwner = async () => {
        if (!selectedGroup || !newOwnerId) return;
        try {
            const { error } = await supabase
                .from('groups')
                .update({ owner_id: newOwnerId })
                .eq('id', selectedGroup.id);

            if (error) throw error;
            notifications.show({ message: '대표자가 변경되었습니다', color: 'green' });
            closeAssign();
            loadGroups();
        } catch (error) {
            notifications.show({ message: '변경 실패', color: 'red' });
        }
    };

    return (
        <Stack gap="md">
            <Paper shadow="sm" radius="md" p="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Text size="lg" fw={700}>그룹 관리</Text>
                    <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={openCreate}
                        variant="filled"
                        color="blue"
                    >
                        그룹 생성
                    </Button>
                </Group>

                <div style={{ position: 'relative', minHeight: 200 }}>
                    <LoadingOverlay visible={loading} />
                    <Table.ScrollContainer minWidth={800}>
                        <Table verticalSpacing="sm">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>그룹명</Table.Th>
                                    <Table.Th>대표자</Table.Th>
                                    <Table.Th>초대코드</Table.Th>
                                    <Table.Th>멤버</Table.Th>
                                    <Table.Th>상태</Table.Th>
                                    <Table.Th>생성일</Table.Th>
                                    <Table.Th style={{ textAlign: 'right' }}>관리</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {groups.map((group) => (
                                    <Table.Tr key={group.id}>
                                        <Table.Td>
                                            <Group gap="sm">
                                                <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                                                    <IconUsers size={20} />
                                                </ThemeIcon>
                                                <div>
                                                    <Text size="sm" fw={500}>{group.name}</Text>
                                                    <Text size="xs" c="dimmed" truncate w={200}>
                                                        {group.description || '설명 없음'}
                                                    </Text>
                                                </div>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="xs">
                                                <Avatar size="sm" radius="xl">
                                                    {group.owner?.nickname.charAt(0)}
                                                </Avatar>
                                                <Text size="sm">{group.owner?.nickname || '미정'}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge variant="outline" color="gray" size="sm">
                                                {group.invite_code}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge variant="light" color="indigo">N/A명</Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge
                                                variant="dot"
                                                color={group.approval_status === 'approved' ? 'green' : 'yellow'}
                                            >
                                                {group.approval_status}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" c="dimmed">
                                                {dayjs(group.created_at).format('YYYY.MM.DD')}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td style={{ textAlign: 'right' }}>
                                            <Menu shadow="md" width={200} position="bottom-end">
                                                <Menu.Target>
                                                    <ActionIcon variant="subtle" color="gray"><IconDots size={16} /></ActionIcon>
                                                </Menu.Target>
                                                <Menu.Dropdown>
                                                    {group.approval_status === 'pending' && (
                                                        <>
                                                            <Menu.Item leftSection={<IconCheck size={14} />} color="green" onClick={() => handleApproval(group.id, 'approved')}>승인</Menu.Item>
                                                            <Menu.Item leftSection={<IconX size={14} />} color="red" onClick={() => handleApproval(group.id, 'rejected')}>거절</Menu.Item>
                                                            <Menu.Divider />
                                                        </>
                                                    )}
                                                    <Menu.Item
                                                        leftSection={<IconUserPlus size={14} />}
                                                        onClick={() => {
                                                            setSelectedGroup(group);
                                                            setNewOwnerId(group.owner_id);
                                                            openAssign();
                                                        }}
                                                    >
                                                        대표자 변경
                                                    </Menu.Item>
                                                </Menu.Dropdown>
                                            </Menu>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                </div>
            </Paper>


            {/* Create Group Modal */}
            <Modal opened={createOpened} onClose={closeCreate} title="새 그룹 생성 (관리자)">
                <form onSubmit={createForm.onSubmit(handleCreateGroup)}>
                    <Stack>
                        <TextInput label="그룹명" required {...createForm.getInputProps('name')} />
                        <Textarea label="설명" {...createForm.getInputProps('description')} />
                        <TextInput label="초대 코드" required {...createForm.getInputProps('invite_code')} />
                        <Select
                            label="대표자 지정"
                            required
                            data={users.map(u => ({ value: u.id, label: `${u.name} (${u.nickname})` }))}
                            {...createForm.getInputProps('owner_id')}
                        />
                        <Button type="submit" fullWidth mt="md">그룹 생성</Button>
                    </Stack>
                </form>
            </Modal>

            {/* Change Owner Modal */}
            <Modal opened={assignOpened} onClose={closeAssign} title="그룹 대표자 변경">
                <Stack>
                    <Text size="sm">그룹 <b>{selectedGroup?.name}</b>의 새로운 리더를 선택하세요.</Text>
                    <Select
                        label="새 대표자"
                        data={users.map(u => ({ value: u.id, label: `${u.name} (${u.nickname})` }))}
                        value={newOwnerId}
                        onChange={setNewOwnerId}
                        searchable
                    />
                    <Button onClick={handleUpdateOwner} fullWidth mt="md">저장</Button>
                </Stack>
            </Modal>
        </Stack>
    );
}
