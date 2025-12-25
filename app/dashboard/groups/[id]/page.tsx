'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Container,
    Title,
    Stack,
    Group,
    Text,
    Button,
    Card,
    Select,
    Loader,
    Center,
    Table,
    Avatar,
    Modal,
    Grid,
    Paper,
    SegmentedControl,
    ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DatePickerInput } from '@mantine/dates';
import { IconTrophy, IconRun, IconClock, IconCalendar, IconSettings, IconUserExclamation } from '@tabler/icons-react';
import { TextInput, Textarea, Tabs } from '@mantine/core';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { formatWorkoutDistance, formatWorkoutDuration } from '@/lib/utils/format';
import type { Workout, UserProfile, Group as GroupType } from '@/types';

dayjs.extend(isBetween);

type DateRangeType = '1week' | '1month' | '3months' | 'custom';

type AggregatedStats = {
    userId: string;
    user: UserProfile;
    totalDistance: number;
    totalDuration: number;
    totalWorkouts: number;
    byType: Record<string, { count: number; distance: number; duration: number }>;
};

export default function GroupDetailPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();

    // State
    const [group, setGroup] = useState<GroupType | null>(null);
    const [loading, setLoading] = useState(true);
    const [rangeType, setRangeType] = useState<DateRangeType>('1week');
    const [customDateRange, setCustomDateRange] = useState<[Date | null, Date | null]>([null, null]);
    const [members, setMembers] = useState<UserProfile[]>([]);
    const [workouts, setWorkouts] = useState<Workout[]>([]);

    // Detail Modal State
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    // Admin Modal State
    const [adminModalOpen, setAdminModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeAdminTab, setActiveAdminTab] = useState<'info' | 'members'>('info');

    // Group Update Form
    const [groupName, setGroupName] = useState('');
    const [groupDesc, setGroupDesc] = useState('');

    useEffect(() => {
        if (group) {
            setGroupName(group.name);
            setGroupDesc(group.description || '');
        }
    }, [group]);

    const handleUpdateGroup = async () => {
        if (!group) return;
        try {
            const { error } = await supabase
                .from('groups')
                .update({ name: groupName, description: groupDesc })
                .eq('id', group.id);

            if (error) throw error;

            setGroup({ ...group, name: groupName, description: groupDesc });
            notifications.show({ title: '성공', message: '그룹 정보가 수정되었습니다', color: 'green' });
            setAdminModalOpen(false);
        } catch (error) {
            console.error('Update group error:', error);
            notifications.show({ title: '오류', message: '그룹 정보 수정 실패', color: 'red' });
        }
    };

    const handleTransferOwnership = async (newOwnerId: string, newOwnerName: string) => {
        if (!confirm(`${newOwnerName}님에게 그룹 리더 권한을 양도하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

        try {
            const { error } = await supabase
                .from('groups')
                .update({ owner_id: newOwnerId })
                .eq('id', params.id);

            if (error) throw error;

            notifications.show({ title: '성공', message: `리더가 ${newOwnerName}님으로 변경되었습니다`, color: 'blue' });
            setAdminModalOpen(false);
            loadGroupAndMembers(); // Reload to reflect changes (effectively removing admin access for current user)
        } catch (error) {
            console.error('Transfer owner error:', error);
            notifications.show({ title: '오류', message: '권한 양도 실패', color: 'red' });
        }
    };


    // Initial Load
    useEffect(() => {
        loadGroupAndMembers();
    }, [params.id]);

    // Data Load on Range Change
    useEffect(() => {
        if (members.length > 0) {
            loadWorkouts();
        }
    }, [members, rangeType, customDateRange]);

    const getDateRange = () => {
        const today = dayjs();
        let start = today;
        let end = today;

        if (rangeType === '1week') {
            start = today.subtract(1, 'week');
        } else if (rangeType === '1month') {
            start = today.subtract(1, 'month');
        } else if (rangeType === '3months') {
            start = today.subtract(3, 'months');
        } else if (rangeType === 'custom' && customDateRange[0] && customDateRange[1]) {
            start = dayjs(customDateRange[0]);
            end = dayjs(customDateRange[1]);
        }

        return { start, end };
    };

    const loadGroupAndMembers = async () => {
        try {
            // Get Current User
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);

            // Load Group
            const { data: groupData, error: groupError } = await supabase
                .from('groups')
                .select('*, owner:user_profiles(*)')
                .eq('id', params.id)
                .single();

            if (groupError) throw groupError;
            setGroup(groupData);

            // Load Members
            const { data: memberData, error: memberError } = await supabase
                .from('group_members')
                .select('user:user_profiles(*)')
                .eq('group_id', params.id);

            if (memberError) throw memberError;

            const validMembers = (memberData || [])
                .map((m: any) => m.user)
                .filter((u: any): u is UserProfile => u !== null);

            setMembers(validMembers);
        } catch (error) {
            console.error('Error loading group:', error);
        }
    };

    const loadWorkouts = async () => {
        const { start, end } = getDateRange();
        const startDateStr = start.format('YYYY-MM-DD');
        const endDateStr = end.format('YYYY-MM-DD');
        const memberIds = members.map(m => m.id);

        if (memberIds.length === 0) return;

        setLoading(true);
        try {
            // Fetch workouts for all members in range
            // Note: We currently fetch ALL records and filter in memory if needed,
            // or just trust the backend. For privacy, we usually filter out 'private'
            // unless it's the current user, but for simplicity here we assume
            // group members share data.
            // Let's filter out strictly 'private' ones to be safe.
            const { data, error } = await supabase
                .from('workouts')
                .select('*, user:user_profiles(*), images:workout_images(*), reactions:workout_reactions(count), comments:workout_comments(count)')
                .in('user_id', memberIds)
                .gte('workout_date', startDateStr)
                .lte('workout_date', endDateStr)
                .neq('sharing_type', 'private') // Basic privacy
                .order('workout_date', { ascending: false });

            if (error) throw error;
            setWorkouts(data || []);
        } catch (error) {
            console.error('Error loading workouts:', error);
        } finally {
            setLoading(false);
        }
    };

    // Aggregation Logic
    const stats: AggregatedStats[] = useMemo(() => {
        const map = new Map<string, AggregatedStats>();

        // Initialize for all members (so even those with 0 workouts show up)
        members.forEach(member => {
            map.set(member.id, {
                userId: member.id,
                user: member,
                totalDistance: 0,
                totalDuration: 0,
                totalWorkouts: 0,
                byType: {}
            });
        });

        workouts.forEach(workout => {
            const stat = map.get(workout.user_id);
            if (stat) {
                stat.totalDistance += workout.distance_meters;
                stat.totalDuration += workout.duration_seconds;
                stat.totalWorkouts += 1;

                if (!stat.byType[workout.workout_type]) {
                    stat.byType[workout.workout_type] = { count: 0, distance: 0, duration: 0 };
                }
                stat.byType[workout.workout_type].count += 1;
                stat.byType[workout.workout_type].distance += workout.distance_meters;
                stat.byType[workout.workout_type].duration += workout.duration_seconds;
            }
        });

        return Array.from(map.values()).sort((a, b) => b.totalDistance - a.totalDistance);
    }, [members, workouts]);

    // Prepare Chart Data
    const chartData = stats.map(s => ({
        name: s.user.nickname,
        distance: Number((s.totalDistance / 1000).toFixed(2)), // km
        count: s.totalWorkouts,
        duration: Number((s.totalDuration / 3600).toFixed(2)), // hours
    }));

    const handleUserClick = (user: UserProfile) => {
        setSelectedUser(user);
        setDetailModalOpen(true);
    };

    const selectedUserWorkouts = useMemo(() => {
        if (!selectedUser) return [];
        return workouts.filter(w => w.user_id === selectedUser.id);
    }, [workouts, selectedUser]);

    if (!group && loading) {
        return <Center h={400}><Loader /></Center>;
    }

    if (!group) {
        return <Container><Text>그룹을 찾을 수 없습니다.</Text></Container>;
    }

    return (
        <Container size="xl">
            <Stack gap="lg">
                <Group justify="space-between">
                    <div>
                        <Title order={2}>{group.name}</Title>
                        <Text c="dimmed">{group.description}</Text>
                    </div>
                    {currentUser && group.owner_id === currentUser.id && (
                        <Button
                            variant="light"
                            leftSection={<IconSettings size={16} />}
                            onClick={() => setAdminModalOpen(true)}
                        >
                            그룹 관리
                        </Button>
                    )}
                </Group>

                {/* Filters */}
                <Paper withBorder p="md" radius="md">
                    <Group>
                        <Select
                            label="기간 설정"
                            value={rangeType}
                            onChange={(v) => setRangeType(v as DateRangeType)}
                            data={[
                                { value: '1week', label: '최근 1주일' },
                                { value: '1month', label: '최근 1개월' },
                                { value: '3months', label: '최근 3개월' },
                                { value: 'custom', label: '직접 선택' },
                            ]}
                        />
                        {rangeType === 'custom' && (
                            <DatePickerInput
                                type="range"
                                label="날짜 범위"
                                placeholder="시작일 - 종료일"
                                value={customDateRange}
                                onChange={(v: any) => setCustomDateRange(v)}
                            />
                        )}
                    </Group>
                </Paper>

                {/* Dashboard Grid */}
                <Grid>
                    {/* Charts Section */}
                    <Grid.Col span={{ base: 12, md: 12 }}>
                        <Card withBorder radius="md" p="xl">
                            <Title order={4} mb="lg">마일리지 비교 (km)</Title>
                            <div style={{ height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ left: 50 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={80} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="distance" name="거리 (km)" fill="#228be6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Card withBorder radius="md" p="xl">
                            <Title order={4} mb="lg">운동 횟수 비교</Title>
                            <div style={{ height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="count" name="횟수" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Card withBorder radius="md" p="xl">
                            <Title order={4} mb="lg">운동 시간 비교 (시간)</Title>
                            <div style={{ height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="duration" name="시간 (hr)" fill="#ffc658" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Grid.Col>

                    {/* Stats Table */}
                    <Grid.Col span={12}>
                        <Card withBorder radius="md" p="md">
                            <Title order={4} mb="md">멤버별 상세 현황</Title>
                            <Table.ScrollContainer minWidth={500}>
                                <Table highlightOnHover>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>멤버</Table.Th>
                                            <Table.Th>총 거리</Table.Th>
                                            <Table.Th>총 시간</Table.Th>
                                            <Table.Th>운동 횟수</Table.Th>
                                            <Table.Th>상세보기</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {stats.map((stat) => (
                                            <Table.Tr key={stat.userId} onClick={() => handleUserClick(stat.user)} style={{ cursor: 'pointer' }}>
                                                <Table.Td>
                                                    <Group gap="sm">
                                                        <Avatar radius="xl" size="sm" color="initials">{stat.user.nickname.substring(0, 2)}</Avatar>
                                                        <Text size="sm" fw={500}>{stat.user.nickname}</Text>
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td>{formatWorkoutDistance(stat.totalDistance, 'running')}</Table.Td> {/* Using generic formatter */}
                                                <Table.Td>{formatWorkoutDuration(stat.totalDuration)}</Table.Td>
                                                <Table.Td>{stat.totalWorkouts}회</Table.Td>
                                                <Table.Td>
                                                    <Button variant="light" size="xs" onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUserClick(stat.user);
                                                    }}>
                                                        기록 보기
                                                    </Button>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                    </Table.Tbody>
                                </Table>
                            </Table.ScrollContainer>
                        </Card>
                    </Grid.Col>
                </Grid>
            </Stack>

            {/* User Detail Modal */}
            <Modal
                opened={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                title={selectedUser ? `${selectedUser.nickname}님의 운동 기록` : '운동 기록'}
                size="lg"
                scrollAreaComponent={Table.ScrollContainer}
            >
                <Stack>
                    {selectedUserWorkouts.length > 0 ? (
                        selectedUserWorkouts.map(workout => (
                            <WorkoutCard key={workout.id} workout={workout} />
                        ))
                    ) : (
                        <Text c="dimmed" ta="center" py="xl">해당 기간의 운동 기록이 없습니다.</Text>
                    )}
                </Stack>
            </Modal>

            {/* Admin Modal */}
            <Modal
                opened={adminModalOpen}
                onClose={() => setAdminModalOpen(false)}
                title="그룹 관리"
                size="lg"
            >
                <Tabs value={activeAdminTab} onChange={(v) => setActiveAdminTab(v as 'info' | 'members')}>
                    <Tabs.List mb="md">
                        <Tabs.Tab value="info" leftSection={<IconSettings size={14} />}>기본 정보 수정</Tabs.Tab>
                        <Tabs.Tab value="members" leftSection={<IconUserExclamation size={14} />}>멤버 관리 / 리더 양도</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="info">
                        <Stack>
                            <TextInput
                                label="그룹 이름"
                                value={groupName}
                                onChange={(e) => setGroupName(e.currentTarget.value)}
                            />
                            <Textarea
                                label="그룹 설명"
                                value={groupDesc}
                                onChange={(e) => setGroupDesc(e.currentTarget.value)}
                                minRows={3}
                            />
                            <Group justify="flex-end">
                                <Button onClick={handleUpdateGroup}>수정 저장</Button>
                            </Group>
                        </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="members">
                        <Text size="sm" c="dimmed" mb="md">
                            리더 권한을 다른 멤버에게 양도할 수 있습니다. 권한을 양도하면 더 이상 이 그룹의 설정을 변경할 수 없습니다.
                        </Text>
                        <Table>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>멤버</Table.Th>
                                    <Table.Th>역할</Table.Th>
                                    <Table.Th>관리</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {members.map((member) => (
                                    <Table.Tr key={member.id}>
                                        <Table.Td>
                                            <Group gap="sm">
                                                <Avatar size="sm" radius="xl">{member.nickname.substring(0, 2)}</Avatar>
                                                <Text size="sm">{member.nickname}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            {group?.owner_id === member.id ? (
                                                <Text size="xs" c="blue" fw={700}>리더</Text>
                                            ) : (
                                                <Text size="xs">멤버</Text>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            {group?.owner_id !== member.id && (
                                                <Button
                                                    color="red"
                                                    variant="light"
                                                    size="xs"
                                                    onClick={() => handleTransferOwnership(member.id, member.nickname)}
                                                >
                                                    리더 양도
                                                </Button>
                                            )}
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </Tabs.Panel>
                </Tabs>
            </Modal>
        </Container>
    );
}
