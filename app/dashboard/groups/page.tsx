'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container,
    Title,
    Stack,
    Card,
    Group,
    Text,
    Button,
    Badge,
    Grid,
    Loader,
    Center,
    Modal,
    TextInput,
    Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconUsers, IconCrown } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import type { Group as GroupType } from '@/types';
import { generateInviteCode } from '@/lib/utils/helpers';

export default function GroupsPage() {
    const router = useRouter();
    const [groups, setGroups] = useState<GroupType[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
    const [joinOpened, { open: openJoin, close: closeJoin }] = useDisclosure(false);
    const supabase = createClient();

    const createForm = useForm({
        initialValues: {
            name: '',
            description: '',
        },
        validate: {
            name: (value) => (value.trim() ? null : '그룹 이름을 입력해주세요'),
        },
    });

    const joinForm = useForm({
        initialValues: {
            invite_code: '',
        },
        validate: {
            invite_code: (value) => (value.trim() ? null : '초대 코드를 입력해주세요'),
        },
    });

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('group_members')
                .select(`
          *,
          group:groups(*, owner:user_profiles(*))
        `)
                .eq('user_id', user.id);

            if (error) throw error;

            const groupsData = data
                .map(gm => gm.group);
            // .filter(g => g.approval_status === 'approved'); // Allow viewing pending groups

            setGroups(groupsData);
        } catch (error) {
            console.error('Load groups error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (values: typeof createForm.values) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const inviteCode = generateInviteCode();

            const { error } = await supabase.from('groups').insert({
                name: values.name,
                description: values.description,
                owner_id: user.id,
                invite_code: inviteCode,
                approval_status: 'pending',
            });

            if (error) throw error;

            notifications.show({
                title: '그룹 생성 요청',
                message: '관리자 승인 대기 중입니다',
                color: 'blue',
            });

            closeCreate();
            createForm.reset();
        } catch (error) {
            console.error('Create group error:', error);
            notifications.show({
                title: '오류',
                message: '그룹 생성에 실패했습니다',
                color: 'red',
            });
        }
    };

    const handleJoinGroup = async (values: typeof joinForm.values) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Find group by invite code
            // Find group by invite code using RPC to bypass RLS
            const { data: group, error: groupError } = await supabase
                .rpc('get_group_by_invite_code', { code: values.invite_code.toUpperCase() })
                .returns<GroupType>()
                .single();

            if (groupError || !group) {
                notifications.show({
                    title: '오류',
                    message: '유효하지 않은 초대 코드입니다',
                    color: 'red',
                });
                return;
            }

            const targetGroup = group as GroupType;

            // Check if already a member
            const { data: existing } = await supabase
                .from('group_members')
                .select('*')
                .eq('group_id', targetGroup.id)
                .eq('user_id', user.id)
                .single();

            if (existing) {
                notifications.show({
                    title: '알림',
                    message: '이미 가입된 그룹입니다',
                    color: 'yellow',
                });
                closeJoin();
                return;
            }

            // Join group
            const { error } = await supabase.from('group_members').insert({
                group_id: targetGroup.id,
                user_id: user.id,
            });

            if (error) throw error;

            notifications.show({
                title: '성공',
                message: '그룹에 가입했습니다',
                color: 'green',
            });

            closeJoin();
            joinForm.reset();
            loadGroups();
        } catch (error) {
            console.error('Join group error:', error);
            notifications.show({
                title: '오류',
                message: '그룹 가입에 실패했습니다',
                color: 'red',
            });
        }
    };

    if (loading) {
        return (
            <Center h={400}>
                <Loader />
            </Center>
        );
    }

    return (
        <Container size="md">
            <Stack>
                <Group justify="space-between">
                    <Title order={2}>내 그룹</Title>
                    <Group>
                        <Button variant="light" onClick={openJoin}>
                            그룹 참여
                        </Button>
                        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
                            그룹 생성
                        </Button>
                    </Group>
                </Group>

                {groups.length === 0 ? (
                    <Card withBorder p="xl">
                        <Text c="dimmed" ta="center">
                            가입된 그룹이 없습니다. 그룹을 생성하거나 참여해보세요!
                        </Text>
                    </Card>
                ) : (
                    <Grid>
                        {groups.map((group) => (
                            <Grid.Col key={group.id} span={{ base: 12, sm: 6 }}>
                                <Card
                                    withBorder
                                    shadow="sm"
                                    padding="lg"
                                    onClick={() => router.push(`/dashboard/groups/${group.id}`)}
                                    style={{ cursor: 'pointer', height: '100%' }}
                                >
                                    <Stack>
                                        <Group justify="space-between">
                                            <Text fw={600} size="lg">{group.name}</Text>
                                            <IconUsers size={20} />
                                        </Group>

                                        <Text size="sm" c="dimmed" lineClamp={2}>
                                            {group.description || '설명이 없습니다'}
                                        </Text>

                                        <Group>
                                            <Badge variant="light" leftSection={<IconCrown size={12} />}>
                                                {group.owner?.nickname}
                                            </Badge>
                                            <Badge variant="outline">
                                                코드: {group.invite_code}
                                            </Badge>
                                        </Group>
                                    </Stack>
                                </Card>
                            </Grid.Col>
                        ))}
                    </Grid>
                )}
            </Stack>

            <Modal opened={createOpened} onClose={closeCreate} title="새 그룹 만들기">
                <form onSubmit={createForm.onSubmit(handleCreateGroup)}>
                    <Stack>
                        <TextInput
                            label="그룹  이름"
                            required
                            {...createForm.getInputProps('name')}
                        />
                        <Textarea
                            label="그룹 설명"
                            placeholder="그룹에 대해 설명해주세요"
                            {...createForm.getInputProps('description')}
                        />
                        <Button type="submit">생성하기</Button>
                    </Stack>
                </form>
            </Modal>

            <Modal opened={joinOpened} onClose={closeJoin} title="그룹 참여하기">
                <form onSubmit={joinForm.onSubmit(handleJoinGroup)}>
                    <Stack>
                        <TextInput
                            label="초대 코드"
                            placeholder="8자리 초대 코드 입력"
                            required
                            {...joinForm.getInputProps('invite_code')}
                        />
                        <Button type="submit">참여하기</Button>
                    </Stack>
                </form>
            </Modal>
        </Container>
    );
}
