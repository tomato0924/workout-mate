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
    Checkbox,
    ColorSwatch,
    CheckIcon,
    rem,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DatePickerInput } from '@mantine/dates';
import { IconTrophy, IconRun, IconClock, IconCalendar, IconSettings, IconUserExclamation, IconBike, IconSwimming, IconArrowUpRight, IconTarget, IconUser } from '@tabler/icons-react';
import { TextInput, Textarea, Tabs } from '@mantine/core';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { formatWorkoutDistance, formatWorkoutDuration } from '@/lib/utils/format';
import type { Workout, UserProfile, Group as GroupType, GroupGoal, WorkoutType } from '@/types';

dayjs.extend(isBetween);

type DateRangeType = '1week' | '1month' | '3months' | 'custom';

type AggregatedStats = {
    userId: string;
    user: UserProfile;
    totalDistance: number;
    totalDuration: number;
    totalWorkouts: number;
    totalWorkoutDays: number;
    byType: Record<string, { count: number; distance: number; duration: number; avgOnePace: number; avgSwolf: number }>;
};

// Activity config for UI and logic
const ACTIVITY_CONFIG = {
    running: { label: '달리기', icon: IconRun, color: 'blue', unit: 'km', paceUnit: '/km' },
    swimming: { label: '수영', icon: IconSwimming, color: 'cyan', unit: 'm', paceUnit: '/100m' },
    cycling: { label: '자전거', icon: IconBike, color: 'green', unit: 'km', paceUnit: '/km' },
};

const MEMBER_COLORS = [
    '#339AF0', '#51CF66', '#FCC419', '#FF6B6B', '#845EF7',
    '#20C997', '#FF922B', '#94D82D', '#F06595', '#15AABF'
];

type ActivityType = keyof typeof ACTIVITY_CONFIG;

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

    const [selectedActivity, setSelectedActivity] = useState<ActivityType>('running');
    const [groupGoals, setGroupGoals] = useState<GroupGoal[]>([]);

    // Detail Modal State
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    // Admin Modal State
    const [adminModalOpen, setAdminModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeAdminTab, setActiveAdminTab] = useState<'info' | 'members' | 'goals'>('info');

    // Goal Inputs
    const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});
    const [enabledActivities, setEnabledActivities] = useState<ActivityType[]>(['running', 'swimming', 'cycling']);

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
            notifications.show({ title: '성공', message: '크루 정보가 수정되었습니다', color: 'green' });
            setAdminModalOpen(false);
        } catch (error) {
            console.error('Update group error:', error);
            notifications.show({ title: '오류', message: '크루 정보 수정 실패', color: 'red' });
        }
    };

    const handleTransferOwnership = async (newOwnerId: string, newOwnerName: string) => {
        if (!confirm(`${newOwnerName}님에게 크루 리더 권한을 양도하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

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

    const handleSaveGoals = async () => {
        if (!group) return;
        try {
            const updates: any[] = [];
            const types = ['running', 'swimming', 'cycling'] as const;
            const periods = ['weekly', 'monthly'] as const;

            // Update active types first
            const { error: groupError } = await supabase
                .from('groups')
                .update({ active_activity_types: enabledActivities })
                .eq('id', group.id);
            if (groupError) throw groupError;

            // Update local group state
            setGroup(prev => prev ? ({ ...prev, active_activity_types: enabledActivities }) : null);

            types.forEach(type => {
                periods.forEach(period => {
                    const key = `${type}_${period}`;
                    const val = goalInputs[key];
                    if (val) {
                        updates.push({
                            group_id: group.id,
                            activity_type: type,
                            period_type: period,
                            target_distance: parseFloat(val)
                        });
                    }
                });
            });

            // Upsert goals
            if (updates.length > 0) {
                const { error } = await supabase
                    .from('group_goals')
                    .upsert(updates, { onConflict: 'group_id,activity_type,period_type' });

                if (error) throw error;

                // Reload
                const { data: goalsData } = await supabase.from('group_goals').select('*').eq('group_id', group.id);
                if (goalsData) setGroupGoals(goalsData);
            }

            notifications.show({ title: '성공', message: '목표가 저장되었습니다', color: 'green' });
        } catch (error) {
            console.error('Save goals error:', error);
            notifications.show({ title: '오류', message: '목표 저장 실패', color: 'red' });
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
            setGroup({ ...groupData, goals: [] }); // Initialize with empty goals if relation missing

            if (groupData.active_activity_types) {
                setEnabledActivities(groupData.active_activity_types);
                // Set initial selected activity if current one is not active
                if (groupData.active_activity_types.length > 0 && !groupData.active_activity_types.includes(selectedActivity)) {
                    setSelectedActivity(groupData.active_activity_types[0] as ActivityType);
                }
            }

            // Load Goals (Separate query as it might not be joined in the view yet, or to be safe)
            const { data: goalsData } = await supabase
                .from('group_goals')
                .select('*')
                .eq('group_id', params.id);

            if (goalsData) {
                setGroupGoals(goalsData);
                // Initialize inputs
                const inputs: Record<string, string> = {};
                ['running', 'swimming', 'cycling'].forEach(type => {
                    ['weekly', 'monthly'].forEach(period => {
                        const goal = goalsData.find(g => g.activity_type === type && g.period_type === period);
                        if (goal) inputs[`${type}_${period}`] = goal.target_distance.toString();
                    });
                });
                setGoalInputs(inputs);
            }

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
        const map = new Map<string, AggregatedStats & { uniqueDates: Set<string> }>();

        members.forEach(member => {
            map.set(member.id, {
                userId: member.id,
                user: member,
                totalDistance: 0,
                totalDuration: 0,
                totalWorkouts: 0,
                totalWorkoutDays: 0,
                uniqueDates: new Set(),
                byType: {}
            });
        });

        workouts.forEach(workout => {
            // Filter by selected activity type logic
            let isMatch = false;
            // running includes treadmill
            if (selectedActivity === 'running' && (workout.workout_type === 'running' || workout.workout_type === 'treadmill')) isMatch = true;
            else if (selectedActivity === 'swimming' && workout.workout_type === 'swimming') isMatch = true;
            else if (selectedActivity === 'cycling' && workout.workout_type === 'cycling') isMatch = true;

            if (!isMatch) return;

            const stat = map.get(workout.user_id);
            if (stat) {
                stat.totalDistance += workout.distance_meters;
                stat.totalDuration += workout.duration_seconds;
                stat.totalWorkouts += 1;
                // Track unique dates (assuming workout_date is YYYY-MM-DD or similar date string)
                // If workout_date is full ISO, we might need simple date part, but typically it is YYYY-MM-DD or date type.
                // Based on previous code: startDateStr = start.format('YYYY-MM-DD');
                // The DB field usually stores date string or ts. Let's assume the substring(0, 10) is safe enough or just the value if it's DATE type.
                // Checking previous code: .gte('workout_date', startDateStr) suggests it compares distinct dates.
                stat.uniqueDates.add(workout.workout_date);
            }
        });

        return Array.from(map.values())
            .map(s => ({
                ...s,
                totalWorkoutDays: s.uniqueDates.size
            }))
            .filter(s => s.totalDistance > 0 || s.totalWorkouts > 0) // Optional: only show active? No, show all or 0? 
            // Result needs to be sorted
            .sort((a, b) => b.totalDistance - a.totalDistance);
    }, [members, workouts, selectedActivity]);

    // Prepare Chart Data
    const chartData = stats.map((s, index) => {
        // Correct unit conversion
        const distance = selectedActivity === 'swimming'
            ? s.totalDistance // meters
            : Number((s.totalDistance / 1000).toFixed(2)); // km

        return {
            name: s.user.nickname,
            distance,
            distanceLabel: selectedActivity === 'swimming' ? `${distance}m` : `${distance}km`,
            timeLabel: formatWorkoutDuration(s.totalDuration),
            count: s.totalWorkouts,
            duration: Number((s.totalDuration / 3600).toFixed(2)),
            rank: index + 1, // Assumes stats is already sorted
            fill: MEMBER_COLORS[index % MEMBER_COLORS.length]
        };
    });

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
        return <Container><Text>크루을 찾을 수 없습니다.</Text></Container>;
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
                            크루 관리
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
                <Grid gutter="lg">
                    {/* Stats Table (Moved Top) */}
                    <Grid.Col span={12}>
                        <Card withBorder radius="md" p="md">
                            <Title order={4} mb="md">멤버별 상세 현황</Title>
                            <Table highlightOnHover style={{ tableLayout: 'fixed' }}>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th style={{ textAlign: 'right', width: '33%', padding: '8px 4px', fontSize: '12px' }}>거리</Table.Th>
                                        <Table.Th style={{ textAlign: 'right', width: '34%', padding: '8px 4px', fontSize: '12px' }}>시간</Table.Th>
                                        <Table.Th style={{ textAlign: 'right', width: '33%', padding: '8px 4px', fontSize: '12px' }}>일수</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {stats.map((stat, index) => (
                                        <>
                                            {/* Row 1: Member Info */}
                                            <Table.Tr key={`${stat.userId}-info`} bg="gray.0" style={{ borderBottom: 'none' }}>
                                                <Table.Td colSpan={3} py="xs">
                                                    <Group gap="sm">
                                                        <Group gap={0}>
                                                            {index === 0 && <IconTrophy size={16} color="gold" />}
                                                            <Text fw={index < 3 ? 700 : 400} size="sm" c={index === 0 ? 'yellow.8' : index === 1 ? 'gray.7' : index === 2 ? 'orange.8' : 'dimmed'}>
                                                                {index + 1}위
                                                            </Text>
                                                        </Group>
                                                        <Avatar radius="xl" size="xs" src={stat.user.avatar_url} style={{ border: `1px solid ${MEMBER_COLORS[index % MEMBER_COLORS.length]}` }}>
                                                            <IconUser size="60%" />
                                                        </Avatar>
                                                        <Text size="sm" fw={600}>{stat.user.nickname}</Text>
                                                    </Group>
                                                </Table.Td>
                                            </Table.Tr>
                                            {/* Row 2: Stats */}
                                            <Table.Tr key={`${stat.userId}-stats`} onClick={() => handleUserClick(stat.user)} style={{ cursor: 'pointer' }}>
                                                <Table.Td style={{ textAlign: 'right', padding: '8px 4px' }}>
                                                    <Text fw={600} size="sm">
                                                        {selectedActivity === 'swimming'
                                                            ? `${stat.totalDistance}m`
                                                            : formatWorkoutDistance(stat.totalDistance, 'running')}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td style={{ textAlign: 'right', padding: '8px 4px' }}><Text size="sm">{formatWorkoutDuration(stat.totalDuration)}</Text></Table.Td>
                                                <Table.Td style={{ textAlign: 'right', padding: '8px 4px' }}><Text size="sm">{stat.totalWorkoutDays}일</Text></Table.Td>
                                            </Table.Tr>
                                        </>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </Card>
                    </Grid.Col>

                    {/* Charts Section */}
                    <Grid.Col span={{ base: 12, md: 12 }}>
                        <Card withBorder radius="md" p="xl">
                            {/* Activity Icons Selector */}
                            <Center mb="xl">
                                <Group gap="xl">
                                    {(group?.active_activity_types || ['running', 'swimming', 'cycling']).map((typeRaw) => {
                                        const type = typeRaw as ActivityType;
                                        const config = ACTIVITY_CONFIG[type];
                                        const isSelected = selectedActivity === type;
                                        return (
                                            <Stack key={type} align="center" gap={5}
                                                style={{ cursor: 'pointer', opacity: isSelected ? 1 : 0.5, transform: isSelected ? 'scale(1.1)' : 'none', transition: 'all 0.2s' }}
                                                onClick={() => setSelectedActivity(type)}
                                            >
                                                <ThemeIcon size={60} radius="xl" variant={isSelected ? 'filled' : 'light'} color={config.color}>
                                                    <config.icon size={32} />
                                                </ThemeIcon>
                                                <Text size="sm" fw={isSelected ? 700 : 500}>{config.label}</Text>
                                            </Stack>
                                        );
                                    })}
                                </Group>
                            </Center>

                            <Group justify="space-between" mb="lg">
                                <Title order={4}>
                                    {ACTIVITY_CONFIG[selectedActivity].label} 요약
                                    <Text span size="sm" c="dimmed" fw={400} ml="xs">({ACTIVITY_CONFIG[selectedActivity].unit})</Text>
                                </Title>
                            </Group>

                            {/* Dynamic Height Calculation: 50px per item + buffer, min 300px */}
                            <div style={{ height: Math.max(chartData.length * 50 + 50, 300) }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={1} tick={false} />
                                        <Tooltip
                                            formatter={(value: any, name: any, props: any) => [
                                                `${props.payload.distanceLabel}`,
                                                '거리'
                                            ]}
                                        />
                                        <Legend
                                            content={({ payload }) => (
                                                <Group justify="center" gap="md" mt="md">
                                                    {payload?.map((entry: any, index: number) => (
                                                        <Group key={`legend-${index}`} gap={4}>
                                                            <ColorSwatch color={entry.color} size={12} />
                                                            <Text size="sm">{entry.value}</Text>
                                                        </Group>
                                                    ))}
                                                </Group>
                                            )}
                                        />
                                        {/* Goal Reference Line */}
                                        {(() => {
                                            let targetGoal: number | null = null;
                                            if (rangeType === '1week') {
                                                const goal = groupGoals.find(g => g.activity_type === selectedActivity && g.period_type === 'weekly');
                                                if (goal) targetGoal = goal.target_distance;
                                            } else if (rangeType === '1month') {
                                                const goal = groupGoals.find(g => g.activity_type === selectedActivity && g.period_type === 'monthly');
                                                if (goal) targetGoal = goal.target_distance;
                                            }

                                            if (targetGoal) {
                                                // Check if needs conversion for swimming if swimming is stored in meters but displayed in m (no conversion needed if stored is same unit as display)
                                                // Wait, DB stores target_distance. Typically user enters 'km' or 'm'.
                                                // Activity Config: running(km), swimming(m), cycling(km).
                                                // Assume DB stores in the same unit as input/display.

                                                return <ReferenceLine x={targetGoal} stroke="red" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: '목표', fill: 'red', fontSize: 12 }} />;
                                            }
                                            return null;
                                        })()}
                                        <Bar dataKey="distance" name="거리" radius={[0, 4, 4, 0]} barSize={40}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                            <LabelList
                                                dataKey="name"
                                                position="insideLeft"
                                                content={(props: any) => {
                                                    const { x, y, width, height, value, index } = props;
                                                    const entry = chartData[index];
                                                    if (!entry) return null;
                                                    return (
                                                        <text
                                                            x={x + 10}
                                                            y={y + height / 2}
                                                            dy={4}
                                                            fill="#fff"
                                                            fontSize={14}
                                                            fontWeight="bold"
                                                            style={{ textShadow: '0px 0px 4px rgba(0,0,0,0.6)' }}
                                                        >
                                                            {value} - {entry.distanceLabel} ({entry.timeLabel})
                                                        </text>
                                                    );
                                                }}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
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
                title="크루 관리"
                size="lg"
            >
                <Tabs value={activeAdminTab} onChange={(v) => setActiveAdminTab(v as 'info' | 'members')}>
                    <Tabs.List mb="md">
                        <Tabs.Tab value="info" leftSection={<IconSettings size={14} />}>기본 정보</Tabs.Tab>
                        <Tabs.Tab value="goals" leftSection={<IconTarget size={14} />}>목표 설정</Tabs.Tab>
                        <Tabs.Tab value="members" leftSection={<IconUserExclamation size={14} />}>멤버 관리</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="goals">
                        <Stack>
                            <Text size="sm" c="dimmed">
                                각 종목별 주간, 월간 목표 거리를 설정할 수 있습니다.
                            </Text>
                            {['running', 'swimming', 'cycling'].map((type) => {
                                const isEnabled = enabledActivities.includes(type as ActivityType);
                                return (
                                    <Card key={type} withBorder p="sm" radius="md" style={{ opacity: isEnabled ? 1 : 0.6 }}>
                                        <Group mb="xs" justify="space-between">
                                            <Group>
                                                <ThemeIcon color={ACTIVITY_CONFIG[type as ActivityType].color} variant="light">
                                                    {(() => {
                                                        const Icon = ACTIVITY_CONFIG[type as ActivityType].icon;
                                                        return <Icon size={16} />;
                                                    })()}
                                                </ThemeIcon>
                                                <Text fw={600}>{ACTIVITY_CONFIG[type as ActivityType].label}</Text>
                                            </Group>
                                            <Checkbox
                                                label="활성화"
                                                checked={isEnabled}
                                                onChange={(e) => {
                                                    if (e.currentTarget.checked) {
                                                        setEnabledActivities([...enabledActivities, type as ActivityType]);
                                                    } else {
                                                        setEnabledActivities(enabledActivities.filter(a => a !== type));
                                                    }
                                                }}
                                            />
                                        </Group>

                                        {isEnabled ? (
                                            <Group grow>
                                                <TextInput
                                                    label="주간 목표"
                                                    placeholder="0"
                                                    rightSection={<Text size="xs" c="dimmed">{ACTIVITY_CONFIG[type as ActivityType].unit}</Text>}
                                                    value={goalInputs[`${type}_weekly`] || ''}
                                                    onChange={(e) => setGoalInputs({ ...goalInputs, [`${type}_weekly`]: e.target.value })}
                                                />
                                                <TextInput
                                                    label="월간 목표"
                                                    placeholder="0"
                                                    rightSection={<Text size="xs" c="dimmed">{ACTIVITY_CONFIG[type as ActivityType].unit}</Text>}
                                                    value={goalInputs[`${type}_monthly`] || ''}
                                                    onChange={(e) => setGoalInputs({ ...goalInputs, [`${type}_monthly`]: e.target.value })}
                                                />
                                            </Group>
                                        ) : (
                                            <Text size="sm" c="dimmed" ta="center" py="xs">해당 운동 유형은 이 크루에서 사용하지 않습니다.</Text>
                                        )}
                                    </Card>
                                )
                            })}
                            <Group justify="flex-end" mt="md">
                                <Button onClick={handleSaveGoals} loading={loading}>목표 저장</Button>
                            </Group>
                        </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="info">
                        <Stack>
                            <TextInput
                                label="크루 이름"
                                value={groupName}
                                onChange={(e) => setGroupName(e.currentTarget.value)}
                            />
                            <Textarea
                                label="크루 설명"
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
                            리더 권한을 다른 멤버에게 양도할 수 있습니다. 권한을 양도하면 더 이상 이 크루의 설정을 변경할 수 없습니다.
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
