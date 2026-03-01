'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { Container, Title, Paper, Stack, Text, Group, Avatar, Badge, Button, Modal, TextInput, PasswordInput, FileButton, ActionIcon, Grid, SimpleGrid, LoadingOverlay, Divider, Tabs, Switch, NumberInput, Select, Textarea } from '@mantine/core';
import { IconMail, IconPhone, IconShieldCheck, IconPencil, IconCamera, IconLock, IconUpload, IconCheck, IconTarget, IconBellRinging, IconBellOff } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserProfile, PersonalGoal } from '@/types';
import { WORKOUT_TYPES } from '@/lib/utils/constants';
import { requestNotificationPermissionAndSaveToken } from '@/lib/firebase/fcm';

// Categorized Avatars
const AVATAR_CATEGORIES = {
    male: [
        '/images/avatars/avatar_male_run_01.png',
        '/images/avatars/avatar_male_weight_02.png',
        '/images/avatars/avatar_male_jog_03.png',
        '/images/avatars/avatar_male_smile_04.png',
        '/images/avatars/avatar_male_rest_05.png',
        '/images/avatars/avatar_male_basket_06.png',
        '/images/avatars/avatar_male_cycle_07.png',
        '/images/avatars/avatar_male_yoga_08.png',
    ],
    female: [
        '/images/avatars/avatar_female_run_01.png',
        '/images/avatars/avatar_female_watch_02.png',
        '/images/avatars/avatar_female_yoga_03.png',
        '/images/avatars/avatar_female_hijab_04.png',
        '/images/avatars/avatar_female_tennis_05.png',
        '/images/avatars/avatar_female_music_06.png',
        '/images/avatars/avatar_female_surf_07.png',
        '/images/avatars/avatar_female_water_08.png',
    ],
    animal: [
        '/images/avatars/avatar_animal_shiba_01.png',
        '/images/avatars/avatar_animal_cat_02.png',
        '/images/avatars/avatar_animal_bear_03.png',
        '/images/avatars/avatar_animal_rabbit_04.png',
        '/images/avatars/avatar_animal_fox_05.png',
        '/images/avatars/avatar_animal_penguin_06.png',
    ],
    symbol: [
        '/images/avatars/avatar_symbol_bolt_01.png',
        '/images/avatars/avatar_symbol_fire_02.png',
        '/images/avatars/avatar_symbol_heart_03.png',
    ],
};


function ProfileContent() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [avatarModalOpen, setAvatarModalOpen] = useState(false);
    const [verifyModalOpen, setVerifyModalOpen] = useState(false);
    const [editInfoModalOpen, setEditInfoModalOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [permissionGuideModalOpen, setPermissionGuideModalOpen] = useState(false);

    // Goal State
    const [goalModalOpen, setGoalModalOpen] = useState(false);
    const [goals, setGoals] = useState<PersonalGoal[]>([]);
    const [draftGoals, setDraftGoals] = useState<Record<string, { target_value: number; is_active: boolean }>>({});
    const [activeTab, setActiveTab] = useState<string>('running');
    const [overallGoal, setOverallGoal] = useState('');
    const [overallGoalDirty, setOverallGoalDirty] = useState(false);

    // Auth check state
    const [currentUserEmail, setCurrentUserEmail] = useState('');

    // Push notification setting
    const [pushEnabled, setPushEnabled] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState<string>('default');

    // 브라우저 알림 권한 상태 추적
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, [editInfoModalOpen, permissionGuideModalOpen]);

    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Handle URL query parameters for direct navigation
    useEffect(() => {
        const tab = searchParams.get('tab');
        const activity = searchParams.get('activity');
        const focus = searchParams.get('focus');

        if (tab === 'goals') {
            setGoalModalOpen(true);
            if (activity && ['running', 'swimming', 'cycling', 'hiking'].includes(activity)) {
                setActiveTab(activity);
            }
        }

        // Handle focus=overall_goal parameter from AI Pacemaker redirect
        if (focus === 'overall_goal') {
            setGoalModalOpen(true);
            setActiveTab('overall');
        }
    }, [searchParams]);

    useEffect(() => {
        loadProfile();
        loadGoals();
    }, []);

    const handleSaveOverallGoal = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ overall_goal: overallGoal })
                .eq('id', profile.id);

            if (error) throw error;

            setProfile({ ...profile, overall_goal: overallGoal });
            setOverallGoalDirty(false);
            notifications.show({ title: '성공', message: '종합 목표가 저장되었습니다', color: 'green' });
        } catch (error) {
            console.error('Save overall goal error:', error);
            notifications.show({ title: '오류', message: '목표 저장 실패', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const loadGoals = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('personal_goals')
            .select('*')
            .eq('user_id', user.id);

        if (data) setGoals(data);
    };

    const handleSaveGoals = async (type: string) => {
        if (!profile) return;

        // Find all drafts for this activity type
        const draftedKeys = Object.keys(draftGoals).filter(k => k.startsWith(`${type}-`));
        if (draftedKeys.length === 0) return;

        setLoading(true);
        try {
            const updates = draftedKeys.map(async (key) => {
                const [, period] = key.split('-');
                const draft = draftGoals[key];

                const existingGoal = goals.find(g => g.activity_type === type && g.period_type === period);

                const goalData = {
                    user_id: profile.id,
                    activity_type: type,
                    period_type: period,
                    target_value: draft.target_value,
                    metric_type: type === 'swimming' ? 'distance' : 'distance',
                    is_active: draft.is_active
                };

                if (existingGoal) {
                    return supabase.from('personal_goals').update(goalData).eq('id', existingGoal.id);
                } else {
                    return supabase.from('personal_goals').insert(goalData);
                }
            });

            await Promise.all(updates);

            notifications.show({ message: '목표가 저장되었습니다', color: 'green' });

            // Clear drafts for this type
            setDraftGoals(prev => {
                const newState = { ...prev };
                draftedKeys.forEach(k => delete newState[k]);
                return newState;
            });

            loadGoals();
        } catch (error) {
            console.error(error);
            notifications.show({ message: '목표 저장 실패', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (newTab: string | null) => {
        if (!newTab) return;
        if (newTab === activeTab) return;

        // Check for unsaved changes in current tab
        const hasChanges = Object.keys(draftGoals).some(key => key.startsWith(`${activeTab}-`));

        if (hasChanges) {
            if (window.confirm('저장하지 않은 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?')) {
                // Discard changes
                setDraftGoals(prev => {
                    const newState = { ...prev };
                    Object.keys(newState).filter(k => k.startsWith(`${activeTab}-`)).forEach(k => delete newState[k]);
                    return newState;
                });
                setActiveTab(newTab);
            }
            // If cancel, do nothing (stay on tab)
        } else {
            setActiveTab(newTab);
        }
    };

    const loadProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }
        setCurrentUserEmail(user.email || '');

        const { data } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (data) {
            setProfile(data);
            setOverallGoal(data.overall_goal || '');
            setPushEnabled(!!data.fcm_token);
        }
    };

    // --- Avatar Logic ---
    const handleAvatarSelect = async (url: string) => {
        if (!profile) return;
        setLoading(true);
        try {
            // If it's a file upload url (from handleAvatarUpload), it's already done.
            // If it's a default avatar, we just update the profile.
            const { error } = await supabase
                .from('user_profiles')
                .update({ avatar_url: url } as any) // Casting as any to bypass Potential Type Error if not verified
                .eq('id', profile.id);

            if (error) throw error;

            setProfile(prev => prev ? ({ ...prev, avatar_url: url } as any) : null);
            notifications.show({ message: '아바타가 변경되었습니다', color: 'green' });
            setAvatarModalOpen(false);
        } catch (error) {
            console.error(error);
            notifications.show({ message: '아바타 변경 실패', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarUpload = async (file: File) => {
        if (!profile) return;
        setLoading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            await handleAvatarSelect(publicUrl);
        } catch (error) {
            console.error(error);
            notifications.show({ message: '이미지 업로드 실패', color: 'red' });
            setLoading(false);
        }
    };

    // --- Info Edit Verification Logic ---
    const verifyForm = useForm({
        initialValues: { password: '' },
    });

    const handleVerifyPassword = async (values: typeof verifyForm.values) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: currentUserEmail,
                password: values.password,
            });

            if (error) throw error;

            setVerifyModalOpen(false);
            setEditInfoModalOpen(true);
            verifyForm.reset();
        } catch (error) {
            notifications.show({ message: '비밀번호가 일치하지 않습니다', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    // --- Info Edit Logic ---
    const editForm = useForm({
        initialValues: {
            nickname: '',
        },
        validate: {
            nickname: (val) => (val.length < 2 ? '닉네임은 2글자 이상이어야 합니다' : null),
        },
    });

    useEffect(() => {
        if (profile) {
            editForm.setValues({
                nickname: profile.nickname || '',
            });
        }
    }, [profile]);

    const handleUpdateInfo = async (values: typeof editForm.values) => {
        if (!profile) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ nickname: values.nickname })
                .eq('id', profile.id);

            if (error) throw error;

            setProfile(prev => prev ? ({ ...prev, ...values }) : null);
            notifications.show({ message: '정보가 수정되었습니다', color: 'green' });
            setEditInfoModalOpen(false);
        } catch (error) {
            notifications.show({ message: '정보 수정 실패', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePush = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.currentTarget.checked;

        if (isChecked) {
            // 알림 켜기
            if (typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'denied') {
                    // 이미 브라우저에서 거절됨 -> 가이드 모달 띄우기
                    setPermissionGuideModalOpen(true);
                    return;
                }

                setLoading(true);
                try {
                    const result = await requestNotificationPermissionAndSaveToken();
                    if (result === 'granted') {
                        setPushEnabled(true);
                        setNotificationPermission('granted');
                        if (profile) setProfile({ ...profile, fcm_token: 'active' });
                        notifications.show({ title: '알림 설정', message: '푸시 알림이 활성화되었습니다.', color: 'green' });
                    } else if (result === 'denied') {
                        setNotificationPermission('denied');
                        setPermissionGuideModalOpen(true);
                    } else if (result === 'ios-not-installed') {
                        notifications.show({ title: '안내', message: 'iOS 기기에서는 홈 화면에 앱을 추가해야 알림을 받을 수 있습니다.', color: 'yellow' });
                    } else {
                        const errorMsg = result.toString().startsWith('unsupported:')
                            ? result.toString().split('unsupported:')[1]
                            : '기기 환경으로 인해 푸시 알림을 지원하지 않거나 오류가 발생했습니다.';
                        notifications.show({ title: '오류', message: `알림 설정 실패: ${errorMsg}`, color: 'red' });
                    }
                } finally {
                    setLoading(false);
                }
            } else {
                notifications.show({ title: '알림 설정 안내', message: '브라우저에서 알림을 지원하지 않습니다.', color: 'red' });
            }
        } else {
            // 알림 끄기
            if (!profile) return;
            setLoading(true);
            try {
                const { error } = await supabase
                    .from('user_profiles')
                    .update({ fcm_token: null })
                    .eq('id', profile.id);

                if (error) throw error;

                setPushEnabled(false);
                setProfile({ ...profile, fcm_token: null });
                notifications.show({ title: '알림 설정', message: '푸시 알림이 비활성화되었습니다.', color: 'blue' });
            } catch (error) {
                console.error(error);
                notifications.show({ message: '알림 비활성화에 실패했습니다.', color: 'red' });
            } finally {
                setLoading(false);
            }
        }
    };

    // --- Password Change Logic ---
    const passwordForm = useForm({
        initialValues: {
            newPassword: '',
            confirmPassword: '',
        },
        validate: {
            newPassword: (val) => (val.length < 6 ? '비밀번호는 6자 이상이어야 합니다' : null),
            confirmPassword: (val, values) => (val !== values.newPassword ? '비밀번호가 일치하지 않습니다' : null),
        },
    });

    const handleChangePassword = async (values: typeof passwordForm.values) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: values.newPassword,
            });

            if (error) throw error;

            notifications.show({ message: '비밀번호가 변경되었습니다', color: 'green' });
            setPasswordModalOpen(false);
            passwordForm.reset();
        } catch (error) {
            notifications.show({ message: '비밀번호 변경 실패', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const getRoleBadge = (role: string) => {
        const badges: Record<string, { color: string; label: string }> = {
            super_admin: { color: 'red', label: '슈퍼 관리자' },
            admin: { color: 'orange', label: '관리자' },
            user: { color: 'blue', label: '사용자' },
        };
        return badges[role] || badges.user;
    };

    if (!profile) return null;
    const roleBadge = getRoleBadge(profile.role);
    const avatarUrl = (profile as any).avatar_url; // Safe cast

    return (
        <Container size="sm">
            <LoadingOverlay visible={loading} />
            <Title order={2} mb="md">내 정보</Title>

            <Paper withBorder shadow="sm" p="lg" radius="md">
                <Stack align="center" mb="xl">
                    <div style={{ position: 'relative' }}>
                        <Avatar
                            size={120}
                            radius={120}
                            color="blue"
                            src={avatarUrl}
                            style={{ border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        >
                            {profile.nickname.charAt(0).toUpperCase()}
                        </Avatar>
                        <ActionIcon
                            radius="xl"
                            size="lg"
                            variant="filled"
                            color="blue"
                            style={{ position: 'absolute', bottom: 0, right: 0 }}
                            onClick={() => setAvatarModalOpen(true)}
                        >
                            <IconCamera size={18} />
                        </ActionIcon>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <Title order={3}>{profile.nickname}</Title>
                    </div>
                    <Badge color={roleBadge.color} leftSection={<IconShieldCheck size={12} />}>
                        {roleBadge.label}
                    </Badge>
                </Stack>

                <Stack gap="md">
                    <Group justify="space-between">
                        <Group>
                            <IconMail size={20} color="gray" />
                            <div>
                                <Text size="xs" c="dimmed">이메일</Text>
                                <Text>{profile.email}</Text>
                            </div>
                        </Group>
                    </Group>

                    <Divider my="sm" />

                    <Group grow>
                        <Button variant="light" onClick={() => setVerifyModalOpen(true)}>정보 수정</Button>
                        <Button variant="outline" color="gray" onClick={() => setPasswordModalOpen(true)}>비밀번호 변경</Button>
                    </Group>

                    <Button
                        variant="filled"
                        color="teal"
                        leftSection={<IconTarget size={20} />}
                        onClick={() => setGoalModalOpen(true)}
                    >
                        운동 목표 설정
                    </Button>

                    <Text size="xs" c="dimmed" ta="center" mt="md">
                        가입일: {new Date(profile.created_at).toLocaleDateString('ko-KR')}
                    </Text>
                </Stack>
            </Paper>

            {/* Avatar Selection Modal */}
            <Modal opened={avatarModalOpen} onClose={() => setAvatarModalOpen(false)} title="프로필 이미지 변경" size="lg">
                <Stack>
                    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <Stack gap="xl">
                            {Object.entries(AVATAR_CATEGORIES).map(([category, urls]) => (
                                <div key={category}>
                                    <Text size="sm" fw={500} mb="xs" tt="uppercase" c="dimmed">
                                        {category === 'male' ? '남성' :
                                            category === 'female' ? '여성' :
                                                category === 'animal' ? '동물' : '심볼'}
                                    </Text>
                                    <SimpleGrid cols={4} spacing="md">
                                        {urls.map((url, idx) => (
                                            <ActionIcon
                                                key={idx}
                                                variant="outline"
                                                size={80}
                                                radius="xl"
                                                onClick={() => handleAvatarSelect(url)}
                                                style={{
                                                    borderColor: avatarUrl === url ? '#228be6' : undefined,
                                                    borderWidth: avatarUrl === url ? 3 : 1,
                                                    width: 80,
                                                    height: 80
                                                }}
                                            >
                                                <Avatar src={url} size={70} radius="xl" />
                                            </ActionIcon>
                                        ))}
                                    </SimpleGrid>
                                </div>
                            ))}
                        </Stack>
                    </div>

                    <Divider label="또는" labelPosition="center" />

                    <FileButton onChange={(file) => file && handleAvatarUpload(file)} accept="image/png,image/jpeg">
                        {(props) => (
                            <Button fullWidth variant="default" leftSection={<IconUpload size={16} />} {...props}>
                                내 디바이스에서 업로드
                            </Button>
                        )}
                    </FileButton>
                </Stack>
            </Modal>

            {/* Verification Modal */}
            <Modal opened={verifyModalOpen} onClose={() => setVerifyModalOpen(false)} title="비밀번호 확인">
                <form onSubmit={verifyForm.onSubmit(handleVerifyPassword)}>
                    <Stack>
                        <Text size="sm">정보를 수정하려면 비밀번호를 입력해주세요.</Text>
                        <PasswordInput
                            placeholder="비밀번호"
                            required
                            {...verifyForm.getInputProps('password')}
                        />
                        <Button type="submit">확인</Button>
                    </Stack>
                </form>
            </Modal>

            {/* Edit Info Modal */}
            <Modal opened={editInfoModalOpen} onClose={() => setEditInfoModalOpen(false)} title="내 정보 수정">
                <form onSubmit={editForm.onSubmit(handleUpdateInfo)}>
                    <Stack>
                        <TextInput
                            label="닉네임"
                            required
                            {...editForm.getInputProps('nickname')}
                        />
                        <Divider my="xs" />
                        <Stack gap="xs">
                            <Group justify="space-between">
                                <div>
                                    <Text size="sm" fw={500}>푸시 알림 설정</Text>
                                    <Text size="xs" c="dimmed">새로운 반응이나 댓글 알림 받기</Text>
                                </div>
                                <Switch
                                    checked={pushEnabled}
                                    onChange={handleTogglePush}
                                    size="md"
                                />
                            </Group>
                            {notificationPermission === 'denied' && (
                                <Paper withBorder p="xs" radius="md" bg="red.0" style={{ cursor: 'pointer' }} onClick={() => setPermissionGuideModalOpen(true)}>
                                    <Group gap="xs">
                                        <IconBellOff size={16} color="#e03131" />
                                        <Text size="xs" c="red.7" fw={500}>
                                            브라우저에서 알림이 차단되어 있습니다. 터치하여 해제 방법을 확인하세요.
                                        </Text>
                                    </Group>
                                </Paper>
                            )}
                            {notificationPermission === 'granted' && pushEnabled && (
                                <Paper withBorder p="xs" radius="md" bg="green.0">
                                    <Group gap="xs">
                                        <IconBellRinging size={16} color="#2f9e44" />
                                        <Text size="xs" c="green.7" fw={500}>
                                            알림이 활성화되어 있습니다.
                                        </Text>
                                    </Group>
                                </Paper>
                            )}
                        </Stack>
                        <Divider my="xs" />
                        <Button type="submit">저장</Button>
                    </Stack>
                </form>
            </Modal>

            {/* Permission Guide Modal */}
            <Modal
                opened={permissionGuideModalOpen}
                onClose={() => setPermissionGuideModalOpen(false)}
                title={
                    <Group gap="xs">
                        <IconBellOff size={22} color="#e03131" />
                        <Text fw={700}>알림 권한 설정 안내</Text>
                    </Group>
                }
                centered
                radius="md"
            >
                <Stack gap="md">
                    <Text size="sm" c="dimmed">
                        현재 브라우저에서 알림이 차단되어 있습니다. 아래 안내에 따라 직접 권한을 허용해주세요.
                    </Text>

                    <Paper withBorder p="md" radius="md" bg="blue.0">
                        <Text size="sm" fw={600} mb="xs">📱 Android (Chrome)</Text>
                        <Stack gap={4}>
                            <Text size="xs">1. Chrome 주소창 왼쪽의 <b>🔒 자물쇠</b> 또는 <b>ⓘ 아이콘</b>을 터치합니다.</Text>
                            <Text size="xs">2. <b>"권한"</b> 또는 <b>"사이트 설정"</b>을 선택합니다.</Text>
                            <Text size="xs">3. <b>"알림"</b> 항목을 <b>"허용"</b>으로 변경합니다.</Text>
                            <Text size="xs">4. 페이지를 새로고침한 후 다시 알림을 켜주세요.</Text>
                        </Stack>
                    </Paper>

                    <Paper withBorder p="md" radius="md" bg="gray.0">
                        <Text size="sm" fw={600} mb="xs">🍎 iPhone / iPad (Safari)</Text>
                        <Stack gap={4}>
                            <Text size="xs">1. iPhone <b>설정</b> 앱을 엽니다.</Text>
                            <Text size="xs">2. <b>Safari</b> (또는 홈화면에 추가한 앱 이름)를 선택합니다.</Text>
                            <Text size="xs">3. <b>"알림"</b>을 <b>"허용"</b>으로 변경합니다.</Text>
                            <Text size="xs">4. 앱을 다시 열고 알림을 켜주세요.</Text>
                        </Stack>
                    </Paper>

                    <Paper withBorder p="md" radius="md" bg="grape.0">
                        <Text size="sm" fw={600} mb="xs">💻 PC (Chrome / Edge)</Text>
                        <Stack gap={4}>
                            <Text size="xs">1. 주소창 왼쪽의 <b>🔒 자물쇠 아이콘</b>을 클릭합니다.</Text>
                            <Text size="xs">2. <b>"사이트 설정"</b>을 클릭합니다.</Text>
                            <Text size="xs">3. <b>"알림"</b> 항목을 <b>"허용"</b>으로 변경합니다.</Text>
                        </Stack>
                    </Paper>

                    <Button fullWidth mt="xs" onClick={() => setPermissionGuideModalOpen(false)}>
                        확인했습니다
                    </Button>
                </Stack>
            </Modal>

            {/* Change Password Modal */}
            <Modal opened={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="비밀번호 변경">
                <form onSubmit={passwordForm.onSubmit(handleChangePassword)}>
                    <Stack>
                        <PasswordInput
                            label="새 비밀번호"
                            placeholder="6자 이상 입력"
                            required
                            {...passwordForm.getInputProps('newPassword')}
                        />
                        <PasswordInput
                            label="비밀번호 확인"
                            placeholder="비밀번호 재입력"
                            required
                            {...passwordForm.getInputProps('confirmPassword')}
                        />
                        <Button type="submit">비밀번호 변경</Button>
                    </Stack>
                </form>
            </Modal>

            {/* Goal Setting Modal */}
            <Modal opened={goalModalOpen} onClose={() => setGoalModalOpen(false)} title="운동 목표 설정" size="lg">
                <Tabs value={activeTab} onChange={handleTabChange}>
                    <Tabs.List mb="md">
                        <Tabs.Tab value="overall">종합 목표</Tabs.Tab>
                        <Tabs.Tab value="running">러닝</Tabs.Tab>
                        <Tabs.Tab value="swimming">수영</Tabs.Tab>
                        <Tabs.Tab value="cycling">자전거</Tabs.Tab>
                        <Tabs.Tab value="hiking">등산</Tabs.Tab>
                    </Tabs.List>

                    {/* Overall Goal Tab */}
                    <Tabs.Panel value="overall">
                        <Stack>
                            <Textarea
                                label="종합 목표"
                                placeholder="예: 올해 4월 25일 하프마라톤을 나갈 계획이 있으며, 목표하는 시간은 2시간 안으로 골인하는게 목표입니다."
                                description="달성하고 싶은 운동 목표를 자유롭게 작성해주세요. AI 페이스메이커가 이 목표를 고려하여 조언해드립니다."
                                minRows={4}
                                maxRows={8}
                                value={overallGoal}
                                onChange={(e) => {
                                    setOverallGoal(e.target.value);
                                    setOverallGoalDirty(true);
                                }}
                            />
                            <Button onClick={handleSaveOverallGoal} disabled={!overallGoalDirty}>
                                저장
                            </Button>
                        </Stack>
                    </Tabs.Panel>

                    {['running', 'swimming', 'cycling', 'hiking'].map((type) => (
                        <Tabs.Panel key={type} value={type}>
                            <Stack>
                                {['weekly', 'monthly', 'yearly'].map((period) => {
                                    const currentGoal = goals.find(g => g.activity_type === type && g.period_type === period);
                                    const draftKey = `${type}-${period}`;
                                    const draft = draftGoals[draftKey];

                                    const displayValue = draft ? draft.target_value : (currentGoal?.target_value ?? 0);
                                    const displayActive = draft ? draft.is_active : (currentGoal?.is_active ?? false);

                                    const periodLabel = period === 'weekly' ? '주간 목표' : period === 'monthly' ? '월간 목표' : '연간 목표';
                                    const unit = type === 'swimming' ? 'm' : 'km';

                                    return (
                                        <Paper key={period} withBorder p="sm" radius="md">
                                            <Group justify="space-between" mb="xs">
                                                <Text fw={500}>{periodLabel}</Text>
                                                <Switch
                                                    label="활성화"
                                                    checked={displayActive}
                                                    onChange={(event) => {
                                                        const isChecked = event.currentTarget.checked;
                                                        setDraftGoals(prev => ({
                                                            ...prev,
                                                            [draftKey]: {
                                                                target_value: displayValue,
                                                                is_active: isChecked
                                                            }
                                                        }));
                                                    }}
                                                />
                                            </Group>
                                            <NumberInput
                                                label={`목표 거리 (${unit})`}
                                                placeholder="0"
                                                value={displayValue}
                                                onChange={(val) => {
                                                    setDraftGoals(prev => ({
                                                        ...prev,
                                                        [draftKey]: {
                                                            target_value: Number(val),
                                                            is_active: displayActive
                                                        }
                                                    }));
                                                }}
                                                suffix={` ${unit}`}
                                                min={0}
                                            />
                                        </Paper>
                                    );
                                })}
                                <Button
                                    fullWidth
                                    mt="md"
                                    color="blue"
                                    onClick={() => handleSaveGoals(type)}
                                    disabled={!Object.keys(draftGoals).some(k => k.startsWith(`${type}-`))}
                                >
                                    저장하기 ({Object.keys(draftGoals).filter(k => k.startsWith(`${type}-`)).length}개 변경사항)
                                </Button>
                            </Stack>
                        </Tabs.Panel>
                    ))}
                </Tabs>
            </Modal>
        </Container >
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
