'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
    Container, Title, Group, ActionIcon, Button, Text, Paper, Badge,
    Modal, TextInput, Select, Textarea, Avatar, Tooltip,
    Divider, Stack, Anchor, CloseButton, LoadingOverlay, Box, Table,
    Popover, SegmentedControl, Tabs, Checkbox,
} from '@mantine/core';
import {
    IconCalendarEvent, IconChevronLeft, IconChevronRight, IconPlus,
    IconMapPin, IconClock, IconLink, IconHandStop, IconCalendarDue,
    IconUser, IconNote, IconCheck, IconEdit, IconTrash, IconTicket,
    IconMessage, IconMoodSmile, IconSend, IconCalendar, IconFilter, IconInfoCircle, IconPencil, IconList,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { createClient } from '@/lib/supabase/client';
import type { Competition, CompetitionType, CompetitionRegistrationPeriod, CompetitionComment, UserProfile } from '@/types';
import {
    COMPETITION_TYPE_LABELS,
    COMPETITION_TYPE_COLORS,
    ALL_COMPETITION_TYPES,
    loadSavedFilters,
    saveFilters,
    fetchCompetitions,
    fetchCompetitionsForYear,
    fetchCompetition,
    createCompetition,
    forceCreateCompetition,
    updateCompetition,
    toggleParticipation,
    deleteCompetition,
    checkIsAdmin,
    addRegistrationPeriod,
    deleteRegistrationPeriod,
    fetchRegistrationPeriodsByDateRange,
    fetchComments,
    createComment,
    updateComment,
    deleteComment,
    toggleReaction,
    AVAILABLE_REACTIONS,
} from '@/lib/competitions';
import dayjs from 'dayjs';
import styles from './CompetitionCalendar.module.css';
import CompetitionDetailPanel from './CompetitionDetailPanel';

// Calendar helpers
function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
    return new Date(year, month - 1, 1).getDay();
}

interface CalendarDay {
    date: Date;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    dateStr: string;
}

function generateCalendarDays(year: number, month: number): CalendarDay[] {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfWeek = getFirstDayOfWeek(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days: CalendarDay[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        const date = new Date(year, month - 2, d);
        const dateStr = formatDateStr(date);
        days.push({ date, day: d, isCurrentMonth: false, isToday: dateStr === todayStr, dateStr });
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dateStr = formatDateStr(date);
        days.push({ date, day: d, isCurrentMonth: true, isToday: dateStr === todayStr, dateStr });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
        for (let d = 1; d <= remaining; d++) {
            const date = new Date(year, month, d);
            const dateStr = formatDateStr(date);
            days.push({ date, day: d, isCurrentMonth: false, isToday: dateStr === todayStr, dateStr });
        }
    }

    return days;
}

function formatDateStr(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getEventsForDate(events: Competition[], dateStr: string): Competition[] {
    return events.filter(e => dateStr >= e.start_date && dateStr <= e.end_date);
}

function getEventPosition(event: Competition, dateStr: string): 'single' | 'start' | 'middle' | 'end' {
    if (event.start_date === event.end_date) return 'single';
    if (dateStr === event.start_date) return 'start';
    if (dateStr === event.end_date) return 'end';
    return 'middle';
}

// Registration period type for calendar display
interface RegPeriodCalendarItem {
    id: string;
    competition_id: string;
    competition_name: string;
    category_name: string;
    registration_date: string;
    registration_time?: string | null;
    homepage_url?: string | null;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CompetitionsPage() {
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [regPeriods, setRegPeriods] = useState<RegPeriodCalendarItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<string | null>('calendar');
    const [listYear, setListYear] = useState(new Date().getFullYear());
    const [showMyOnly, setShowMyOnly] = useState(false);
    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [activeFilters, setActiveFilters] = useState<CompetitionType[]>(ALL_COMPETITION_TYPES);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

    // Form state
    const [formType, setFormType] = useState<CompetitionType>('marathon');
    const [formName, setFormName] = useState('');
    const [formAbbr, setFormAbbr] = useState('');
    const [formStartDate, setFormStartDate] = useState('');
    const [formEndDate, setFormEndDate] = useState('');
    const [formStartTime, setFormStartTime] = useState('');
    const [formLocation, setFormLocation] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formMemo, setFormMemo] = useState('');
    const [formSubmitting, setFormSubmitting] = useState(false);

    // Registration period form (within create/edit modal)
    const [regPeriodForms, setRegPeriodForms] = useState<{ category_name: string; registration_date: string; registration_time: string }[]>([]);
    const [existingRegPeriods, setExistingRegPeriods] = useState<CompetitionRegistrationPeriod[]>([]);

    // Touch swipe state for calendar
    const [calTouchStart, setCalTouchStart] = useState<number | null>(null);

    // Comments state
    const [comments, setComments] = useState<CompetitionComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [commentSubmitting, setCommentSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState('');
    const commentInputRef = useRef<HTMLTextAreaElement>(null);

    // Load saved filters on mount
    useEffect(() => {
        setActiveFilters(loadSavedFilters());
    }, []);

    // Load current user + admin check
    useEffect(() => {
        const loadUser = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                if (profile) setCurrentUser(profile);
            }
            const adminStatus = await checkIsAdmin();
            setIsAdmin(adminStatus);
        };
        loadUser();
    }, []);

    // Load competitions + registration periods
    const loadCompetitions = useCallback(async () => {
        setLoading(true);
        if (viewMode === 'list') {
            const data = await fetchCompetitionsForYear(listYear, activeFilters);
            setCompetitions(data);
            setRegPeriods([]);
            setLoading(false);
            return;
        }
        const data = await fetchCompetitions(currentYear, currentMonth, activeFilters);
        setCompetitions(data);

        // Load registration periods for the calendar range
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(currentYear, currentMonth, 0);
        endDate.setDate(endDate.getDate() + 7);
        const startStr = formatDateStr(startDate);
        const endStr = formatDateStr(endDate);

        const periods = await fetchRegistrationPeriodsByDateRange(startStr, endStr, activeFilters);
        const mapped: RegPeriodCalendarItem[] = periods.map(p => ({
            id: p.id,
            competition_id: p.competition_id,
            competition_name: (p as any).competition?.name || '대회',
            category_name: p.category_name,
            registration_date: p.registration_date,
            registration_time: p.registration_time,
            homepage_url: (p as any).competition?.homepage_url,
        }));
        setRegPeriods(mapped);

        setLoading(false);
    }, [currentYear, currentMonth, listYear, activeFilters, viewMode]);

    useEffect(() => {
        loadCompetitions();
    }, [loadCompetitions]);

    // Calendar days
    const calendarDays = useMemo(() =>
        generateCalendarDays(currentYear, currentMonth)
        , [currentYear, currentMonth]);

    // Navigation
    const goToPrevMonth = () => {
        if (currentMonth === 1) { setCurrentYear(y => y - 1); setCurrentMonth(12); }
        else { setCurrentMonth(m => m - 1); }
        setSelectedCompetition(null);
    };
    const goToNextMonth = () => {
        if (currentMonth === 12) { setCurrentYear(y => y + 1); setCurrentMonth(1); }
        else { setCurrentMonth(m => m + 1); }
        setSelectedCompetition(null);
    };
    const goToToday = () => {
        const now = new Date();
        setCurrentYear(now.getFullYear());
        setCurrentMonth(now.getMonth() + 1);
        setSelectedCompetition(null);
    };

    // Filter toggle
    const handleFilterToggle = (type: CompetitionType) => {
        setActiveFilters(prev => {
            const next = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type];
            if (next.length === 0) return prev;
            saveFilters(next);
            return next;
        });
    };

    // Filtered competitions for list view
    const filteredCompetitions = useMemo(() =>
        showMyOnly
            ? competitions.filter(c => c.participants?.some(p => p.user_id === currentUser?.id))
            : competitions,
        [competitions, showMyOnly, currentUser?.id]
    );

    // Event click
    const handleEventClick = async (competition: Competition) => {
        setDetailLoading(true);
        setSelectedCompetition(competition);
        const detail = await fetchCompetition(competition.id);
        if (detail) setSelectedCompetition(detail);
        setDetailLoading(false);
        // Load comments
        loadComments(competition.id);
    };

    // Load comments for a competition
    const loadComments = async (competitionId: string) => {
        setCommentsLoading(true);
        const data = await fetchComments(competitionId);
        setComments(data);
        setCommentsLoading(false);
    };

    // Create comment
    const handleCreateComment = async () => {
        if (!selectedCompetition || !newComment.trim()) return;
        setCommentSubmitting(true);
        const result = await createComment(selectedCompetition.id, newComment.trim());
        setCommentSubmitting(false);
        if (result.error) {
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        setNewComment('');
        loadComments(selectedCompetition.id);
    };

    // Update comment
    const handleUpdateComment = async (commentId: string) => {
        if (!editingCommentText.trim()) return;
        const result = await updateComment(commentId, editingCommentText.trim());
        if (result.error) {
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        setEditingCommentId(null);
        setEditingCommentText('');
        if (selectedCompetition) loadComments(selectedCompetition.id);
    };

    // Delete comment
    const handleDeleteComment = async (commentId: string) => {
        if (!confirm('댓글을 삭제하시겠습니까?')) return;
        const result = await deleteComment(commentId);
        if (result.error) {
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        if (selectedCompetition) loadComments(selectedCompetition.id);
    };

    // Toggle reaction
    const handleToggleReaction = async (commentId: string, emoji: string) => {
        const result = await toggleReaction(commentId, emoji);
        if (result.error) {
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        if (selectedCompetition) loadComments(selectedCompetition.id);
    };

    // Can edit/delete check
    const canEditDelete = (comp: Competition): boolean => {
        if (isAdmin) return true;
        if (currentUser && comp.registered_by === currentUser.id) return true;
        return false;
    };

    // Participation toggle
    const handleParticipate = async () => {
        if (!selectedCompetition) return;
        const result = await toggleParticipation(selectedCompetition.id);
        if (result.error) {
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        notifications.show({
            title: result.participating ? '참가 등록!' : '참가 취소',
            message: result.participating ? '대회 참가 등록이 완료되었습니다 ✋' : '참가가 취소되었습니다.',
            color: result.participating ? 'teal' : 'gray',
        });
        const detail = await fetchCompetition(selectedCompetition.id);
        if (detail) setSelectedCompetition(detail);
        loadCompetitions();
    };

    // Edit competition
    const handleOpenEdit = (comp: Competition) => {
        setEditingCompetition(comp);
        setFormType(comp.competition_type);
        setFormName(comp.name);
        setFormAbbr(comp.abbreviation || '');
        setFormStartDate(comp.start_date);
        setFormEndDate(comp.end_date);
        setFormStartTime(comp.start_time || '');
        setFormLocation(comp.location);
        setFormUrl(comp.homepage_url || '');
        setFormMemo(comp.memo || '');
        setRegPeriodForms([]);
        setExistingRegPeriods(comp.registration_periods || []);
        setDuplicateWarning(null);
        setShowCreateModal(true);
    };

    // Delete competition
    const handleDeleteCompetition = async (comp: Competition) => {
        if (!confirm(`"${comp.name}" 대회를 삭제하시겠습니까?`)) return;
        const result = await deleteCompetition(comp.id);
        if (result.error) {
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        notifications.show({ title: '삭제 완료', message: '대회가 삭제되었습니다.', color: 'teal' });
        setSelectedCompetition(null);
        loadCompetitions();
    };

    // Create / Update competition
    const handleSave = async () => {
        if (!formName || !formStartDate || !formLocation) {
            notifications.show({ title: '오류', message: '필수 항목을 입력해주세요.', color: 'red' });
            return;
        }
        setFormSubmitting(true);
        setDuplicateWarning(null);

        const payload = {
            competition_type: formType,
            name: formName,
            abbreviation: formAbbr || undefined,
            start_date: formStartDate,
            end_date: formEndDate || formStartDate,
            start_time: formStartTime || undefined,
            location: formLocation,
            homepage_url: formUrl || undefined,
            memo: formMemo || undefined,
        };

        if (editingCompetition) {
            // Update existing
            const result = await updateCompetition(editingCompetition.id, payload);
            if (result.error) {
                setFormSubmitting(false);
                notifications.show({ title: '오류', message: result.error, color: 'red' });
                return;
            }
            // Save new registration periods
            for (const rp of regPeriodForms) {
                if (rp.category_name && rp.registration_date) {
                    await addRegistrationPeriod(editingCompetition.id, {
                        category_name: rp.category_name,
                        registration_date: rp.registration_date,
                        registration_time: rp.registration_time || undefined,
                    });
                }
            }
            notifications.show({ title: '수정 완료', message: '대회 정보가 수정되었습니다.', color: 'teal' });
            const updatedCompId = editingCompetition.id;
            setFormSubmitting(false);
            resetForm();
            setShowCreateModal(false);
            setDuplicateWarning(null);

            // Navigate to competition's month and show detail
            const compDate = new Date(formStartDate);
            setCurrentYear(compDate.getFullYear());
            setCurrentMonth(compDate.getMonth() + 1);
            await loadCompetitions();

            // Fetch and show updated competition detail
            const detail = await fetchCompetition(updatedCompId);
            if (detail) {
                setSelectedCompetition(detail);
                loadComments(detail.id);
            }
        } else {
            // Create new
            const result = await createCompetition(payload);
            if (result.duplicateWarning) {
                setFormSubmitting(false);
                setDuplicateWarning(result.duplicateWarning);
                return;
            }
            if (result.error) {
                setFormSubmitting(false);
                notifications.show({ title: '오류', message: result.error, color: 'red' });
                return;
            }
            // Save registration periods for the new competition
            if (result.competition) {
                for (const rp of regPeriodForms) {
                    if (rp.category_name && rp.registration_date) {
                        await addRegistrationPeriod(result.competition.id, {
                            category_name: rp.category_name,
                            registration_date: rp.registration_date,
                            registration_time: rp.registration_time || undefined,
                        });
                    }
                }
            }
            notifications.show({ title: '등록 완료', message: '대회가 등록되었습니다!', color: 'teal' });
            const newCompId = result.competition?.id;
            setFormSubmitting(false);
            resetForm();
            setShowCreateModal(false);
            setDuplicateWarning(null);

            // Navigate to competition's month and show detail
            const compDate = new Date(formStartDate);
            setCurrentYear(compDate.getFullYear());
            setCurrentMonth(compDate.getMonth() + 1);
            await loadCompetitions();

            // Fetch and show new competition detail
            if (newCompId) {
                const detail = await fetchCompetition(newCompId);
                if (detail) {
                    setSelectedCompetition(detail);
                    loadComments(detail.id);
                }
            }
        }
    };

    const handleForceCreate = async () => {
        setFormSubmitting(true);
        const payload = {
            competition_type: formType,
            name: formName,
            abbreviation: formAbbr || undefined,
            start_date: formStartDate,
            end_date: formEndDate || formStartDate,
            start_time: formStartTime || undefined,
            location: formLocation,
            homepage_url: formUrl || undefined,
            memo: formMemo || undefined,
        };
        const result = await forceCreateCompetition(payload);
        if (result.error) {
            setFormSubmitting(false);
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        if (result.competition) {
            for (const rp of regPeriodForms) {
                if (rp.category_name && rp.registration_date) {
                    await addRegistrationPeriod(result.competition.id, {
                        category_name: rp.category_name,
                        registration_date: rp.registration_date,
                        registration_time: rp.registration_time || undefined,
                    });
                }
            }
        }
        setFormSubmitting(false);
        notifications.show({ title: '등록 완료', message: '대회가 등록되었습니다!', color: 'teal' });
        const newCompId = result.competition?.id;
        resetForm();
        setShowCreateModal(false);
        setDuplicateWarning(null);

        // Navigate to competition's month and show detail
        const compDate = new Date(formStartDate);
        setCurrentYear(compDate.getFullYear());
        setCurrentMonth(compDate.getMonth() + 1);
        await loadCompetitions();

        // Fetch and show new competition detail
        if (newCompId) {
            const detail = await fetchCompetition(newCompId);
            if (detail) {
                setSelectedCompetition(detail);
                loadComments(detail.id);
            }
        }
    };

    // Delete existing registration period
    const handleDeleteRegPeriod = async (periodId: string) => {
        const result = await deleteRegistrationPeriod(periodId);
        if (result.error) {
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        setExistingRegPeriods(prev => prev.filter(p => p.id !== periodId));
        notifications.show({ title: '삭제', message: '신청일시가 삭제되었습니다.', color: 'teal' });
    };

    const resetForm = () => {
        setEditingCompetition(null);
        setFormType('marathon');
        setFormName('');
        setFormAbbr('');
        setFormStartDate('');
        setFormEndDate('');
        setFormStartTime('');
        setFormLocation('');
        setFormUrl('');
        setFormMemo('');
        setDuplicateWarning(null);
        setRegPeriodForms([]);
        setExistingRegPeriods([]);
    };

    // Registration period form management
    const addRegPeriodRow = () => {
        setRegPeriodForms(prev => [...prev, { category_name: '', registration_date: '', registration_time: '' }]);
    };
    const updateRegPeriodRow = (index: number, field: string, value: string) => {
        setRegPeriodForms(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };
    const removeRegPeriodRow = (index: number) => {
        setRegPeriodForms(prev => prev.filter((_, i) => i !== index));
    };

    const isParticipating = selectedCompetition?.participants?.some(
        p => p.user_id === currentUser?.id
    );

    // Get reg periods for a specific date
    const getRegPeriodsForDate = (dateStr: string): RegPeriodCalendarItem[] => {
        return regPeriods.filter(rp => rp.registration_date === dateStr);
    };

    return (
        <Container size="lg" py="md">
            {/* Top bar */}
            <div className={styles.topBar}>
                <div className={styles.topTitle}>
                    <IconCalendarEvent size={28} color="#228be6" />
                    <Title order={2}>대회일정</Title>
                </div>
                <Button
                    leftSection={<IconPlus size={18} />}
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan' }}
                    onClick={() => { resetForm(); setShowCreateModal(true); }}
                >
                    대회등록
                </Button>
            </div>

            {/* Competition Type Filter Section */}
            <Group gap="xs" mb="xs" mt="md">
                <IconFilter size={20} color="var(--mantine-color-dimmed)" />
                <Text fw={600} size="sm" c="dimmed">대회 유형 선택</Text>
            </Group>
            <div className={styles.filterBar}>
                {ALL_COMPETITION_TYPES.map(type => {
                    const isActive = activeFilters.includes(type);
                    const color = COMPETITION_TYPE_COLORS[type];
                    return (
                        <div
                            key={type}
                            className={`${styles.filterChip} ${isActive ? styles.filterChipActive : styles.filterChipInactive}`}
                            style={isActive ? { backgroundColor: color } : undefined}
                            onClick={() => handleFilterToggle(type)}
                        >
                            <span style={{
                                width: 7, height: 7, borderRadius: '50%',
                                backgroundColor: isActive ? 'rgba(255,255,255,0.8)' : color,
                                flexShrink: 0,
                            }} />
                            {COMPETITION_TYPE_LABELS[type]}
                        </div>
                    );
                })}
            </div>

            {/* View Mode Tabs */}
            <Tabs value={viewMode} onChange={(val) => setViewMode(val)} mt="xl" mb="md" variant="default">
                <Tabs.List>
                    <Tabs.Tab value="calendar" leftSection={<IconCalendarEvent size={16} />}>
                        캘린더 보기
                    </Tabs.Tab>
                    <Tabs.Tab value="list" leftSection={<IconList size={16} />}>
                        목록 보기
                    </Tabs.Tab>
                </Tabs.List>
            </Tabs>

            {viewMode === 'list' && (
                <Group justify="space-between" align="center" mb="md">
                    <Checkbox
                        label="나의 대회"
                        checked={showMyOnly}
                        onChange={(e) => setShowMyOnly(e.currentTarget.checked)}
                        size="sm"
                    />
                    <Group gap="xs">
                        <ActionIcon variant="default" onClick={() => setListYear(y => y - 1)}>
                            <IconChevronLeft size={16} />
                        </ActionIcon>
                        <Text fw={600}>{listYear}년</Text>
                        <ActionIcon variant="default" onClick={() => setListYear(y => y + 1)}>
                            <IconChevronRight size={16} />
                        </ActionIcon>
                    </Group>
                </Group>
            )}

            {viewMode === 'calendar' && (
            <Paper shadow="sm" radius="md" p="md" pos="relative"
                onTouchStart={(e) => setCalTouchStart(e.touches[0].clientX)}
                onTouchEnd={(e) => {
                    if (calTouchStart === null) return;
                    const diff = e.changedTouches[0].clientX - calTouchStart;
                    if (Math.abs(diff) > 60) {
                        if (diff > 0) goToPrevMonth();
                        else goToNextMonth();
                    }
                    setCalTouchStart(null);
                }}
            >
                <LoadingOverlay visible={loading} loaderProps={{ type: 'dots' }} />

                {/* Month header */}
                <div className={styles.calendarHeader}>
                    <ActionIcon variant="subtle" onClick={goToPrevMonth} size="lg">
                        <IconChevronLeft size={20} />
                    </ActionIcon>
                    <h2>{currentYear}년 {currentMonth}월</h2>
                    <ActionIcon variant="subtle" onClick={goToNextMonth} size="lg">
                        <IconChevronRight size={20} />
                    </ActionIcon>
                    <Tooltip label="오늘로 이동">
                        <ActionIcon variant="light" onClick={goToToday} size="lg">
                            <IconCalendar size={18} />
                        </ActionIcon>
                    </Tooltip>
                </div>

                {/* Weekday header */}
                <div className={styles.weekdayRow}>
                    {WEEKDAYS.map((day) => (
                        <div key={day} className={styles.weekdayCell}>{day}</div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className={styles.calendarGrid}>
                    {calendarDays.map((day, idx) => {
                        const events = getEventsForDate(competitions, day.dateStr);
                        const dayRegPeriods = getRegPeriodsForDate(day.dateStr);
                        const dayOfWeek = idx % 7;

                        return (
                            <div
                                key={day.dateStr + '-' + idx}
                                className={`${styles.dayCell} ${!day.isCurrentMonth ? styles.otherMonth : ''} ${day.isToday ? styles.today : ''}`}
                            >
                                <div className={`${styles.dayNumber} ${dayOfWeek === 0 ? styles.sundayNumber : ''} ${dayOfWeek === 6 ? styles.saturdayNumber : ''}`}>
                                    {day.isToday ? (<span>{day.day}</span>) : (day.day)}
                                </div>
                                <div className={styles.eventList}>
                                    {events.slice(0, 3).map(event => {
                                        const pos = getEventPosition(event, day.dateStr);
                                        const color = COMPETITION_TYPE_COLORS[event.competition_type];
                                        const displayName = event.abbreviation || event.name;
                                        const posClass =
                                            pos === 'start' ? styles.eventBarStart :
                                                pos === 'end' ? styles.eventBarEnd :
                                                    pos === 'middle' ? styles.eventBarMiddle :
                                                        styles.eventBarSingle;

                                        return (
                                            <div
                                                key={event.id}
                                                className={`${styles.eventBadge} ${posClass}`}
                                                style={{ backgroundColor: color }}
                                                onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                                            >
                                                {(pos === 'start' || pos === 'single') && (
                                                    <div className={styles.eventContent}>
                                                        <span className={styles.eventName} title={event.name}>{displayName}</span>
                                                        {event.participants && event.participants.length > 0 && (
                                                            <div className={styles.participantAvatars}>
                                                                {event.participants.slice(0, 2).map(p => (
                                                                    <Avatar key={p.id} size={14} radius="xl" src={p.user?.avatar_url} color="blue">
                                                                        {p.user?.nickname?.charAt(0)}
                                                                    </Avatar>
                                                                ))}
                                                                {event.participants.length > 2 && (
                                                                    <Avatar size={14} radius="xl" color="gray">
                                                                        +{event.participants.length - 2}
                                                                    </Avatar>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {pos === 'middle' && (<span style={{ opacity: 0 }}>-</span>)}
                                                {pos === 'end' && (<span style={{ fontSize: '0.55rem', opacity: 0.8 }}>▸</span>)}
                                            </div>
                                        );
                                    })}
                                    {/* Registration period indicators */}
                                    {dayRegPeriods.map(rp => {
                                        const regDisplayName = rp.competition_name.length > 6
                                            ? rp.competition_name.slice(0, 6) + '..'
                                            : rp.competition_name;
                                        return (
                                            <div
                                                key={`reg-${rp.id}`}
                                                className={`${styles.eventBadge} ${styles.eventBarSingle}`}
                                                style={{ backgroundColor: 'white', fontSize: '0.55rem', border: '1px solid #333', color: '#333' }}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    // Try local first, otherwise fetch from API
                                                    const matchComp = competitions.find(c => c.id === rp.competition_id);
                                                    if (matchComp) {
                                                        handleEventClick(matchComp);
                                                    } else {
                                                        // Competition is in a different month — fetch directly
                                                        setDetailLoading(true);
                                                        const detail = await fetchCompetition(rp.competition_id);
                                                        if (detail) {
                                                            setSelectedCompetition(detail);
                                                            loadComments(detail.id);
                                                        }
                                                        setDetailLoading(false);
                                                    }
                                                }}
                                                title={`[신청] ${rp.competition_name} - ${rp.category_name}${rp.registration_time ? ` ${rp.registration_time}~` : ''}`}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                                    <IconPencil size={10} style={{ flexShrink: 0 }} />
                                                    <span className={styles.eventName}>신청 {regDisplayName}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {events.length > 3 && (
                                        <Text size="xs" c="dimmed" ta="center" style={{ fontSize: '0.6rem' }}>
                                            +{events.length - 3}개
                                        </Text>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Paper>
            )}

            {viewMode === 'list' && (
                <Stack gap="sm" mt="lg">
                    {filteredCompetitions.length === 0 ? (
                        <Paper shadow="sm" radius="md" p="xl" ta="center">
                            <Text c="dimmed">{showMyOnly ? '참가 중인 대회가 없습니다.' : '해당 조건의 대회가 없습니다.'}</Text>
                        </Paper>
                    ) : filteredCompetitions.map((comp) => {
                            const isExpanded = selectedCompetition?.id === comp.id;
                            const isCompParticipating = comp.participants?.some(
                                p => p.user_id === currentUser?.id
                            );
                            return (
                                <Paper key={comp.id} shadow="sm" radius="md" p="md" withBorder>
                                    <Group 
                                        justify="space-between" 
                                        align="center" 
                                        style={{ cursor: 'pointer' }} 
                                        onClick={() => {
                                            if (isExpanded) {
                                                setSelectedCompetition(null);
                                            } else {
                                                // reuse the logic for populating
                                                setSelectedCompetition(comp);
                                                loadComments(comp.id);
                                            }
                                        }}
                                        wrap="nowrap"
                                    >
                                        <Group gap="md" style={{ flex: 1 }} wrap="nowrap">
                                            <div style={{ minWidth: 52, textAlign: 'center' }}>
                                                <Text size="md" fw={700}>
                                                    {dayjs(comp.start_date).format('M/D')}
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                    {WEEKDAYS[dayjs(comp.start_date).day()]}요일
                                                </Text>
                                            </div>
                                            <Divider orientation="vertical" />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <Group gap="xs" mb={4} wrap="nowrap">
                                                    <Badge size="sm" color={COMPETITION_TYPE_COLORS[comp.competition_type]} style={{ flexShrink: 0 }}>
                                                        {COMPETITION_TYPE_LABELS[comp.competition_type]}
                                                    </Badge>
                                                    <Text fw={600} truncate>{comp.abbreviation || comp.name}</Text>
                                                </Group>
                                                <Group gap="xs" wrap="nowrap">
                                                    <IconMapPin size={12} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
                                                    <Text size="xs" c="dimmed" truncate>{comp.location}</Text>
                                                </Group>
                                            </div>
                                            {comp.participants && comp.participants.length > 0 && (
                                                <Avatar.Group spacing="sm" style={{ flexShrink: 0 }}>
                                                    {comp.participants.slice(0, 3).map(p => (
                                                        <Tooltip key={p.id} label={p.user?.nickname}>
                                                            <Avatar size={30} radius="xl" src={p.user?.avatar_url} color="blue">
                                                                {p.user?.nickname?.charAt(0)}
                                                            </Avatar>
                                                        </Tooltip>
                                                    ))}
                                                    {comp.participants.length > 3 && (
                                                        <Avatar size={30} radius="xl" color="gray">
                                                            +{comp.participants.length - 3}
                                                        </Avatar>
                                                    )}
                                                </Avatar.Group>
                                            )}
                                        </Group>
                                        <ActionIcon variant="subtle" style={{ flexShrink: 0 }}>
                                            {isExpanded ? <IconChevronRight size={18} style={{ transform: 'rotate(-90deg)', transition: 'transform 0.2s' }} /> : <IconChevronRight size={18} style={{ transform: 'rotate(90deg)', transition: 'transform 0.2s' }} />}
                                        </ActionIcon>
                                    </Group>

                                    {/* Expanded Detail View */}
                                    {isExpanded && (
                                        <Box mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                                            <CompetitionDetailPanel
                                                selectedCompetition={comp}
                                                detailLoading={detailLoading}
                                                currentUser={currentUser}
                                                isAdmin={isAdmin}
                                                canEditDelete={canEditDelete}
                                                handleOpenEdit={handleOpenEdit}
                                                handleDeleteCompetition={handleDeleteCompetition}
                                                setSelectedCompetition={setSelectedCompetition}
                                                isParticipating={!!isCompParticipating}
                                                handleParticipate={handleParticipate}
                                                comments={comments}
                                                commentsLoading={commentsLoading}
                                                newComment={newComment}
                                                setNewComment={setNewComment}
                                                commentInputRef={commentInputRef}
                                                commentSubmitting={commentSubmitting}
                                                handleCreateComment={handleCreateComment}
                                                editingCommentId={editingCommentId}
                                                setEditingCommentId={setEditingCommentId}
                                                editingCommentText={editingCommentText}
                                                 setEditingCommentText={setEditingCommentText}
                                                handleUpdateComment={handleUpdateComment}
                                                handleDeleteComment={handleDeleteComment}
                                                handleToggleReaction={handleToggleReaction}
                                                viewMode="list"
                                            />
                                        </Box>
                                    )}
                                </Paper>
                            );
                        })}
                </Stack>
            )}

            {/* Competition Detail Section */}
            {viewMode === 'calendar' && selectedCompetition && (
                <Box mt="md">
                    <Group gap="xs" mb="xs">
                        <IconInfoCircle size={20} color="var(--mantine-color-dimmed)" />
                        <Text fw={600} size="sm" c="dimmed">대회 상세정보</Text>
                    </Group>
                    <CompetitionDetailPanel
                        selectedCompetition={selectedCompetition}
                        detailLoading={detailLoading}
                        currentUser={currentUser}
                        isAdmin={isAdmin}
                        canEditDelete={canEditDelete}
                        handleOpenEdit={handleOpenEdit}
                        handleDeleteCompetition={handleDeleteCompetition}
                        setSelectedCompetition={setSelectedCompetition}
                        isParticipating={!!isParticipating}
                        handleParticipate={handleParticipate}
                        comments={comments}
                        commentsLoading={commentsLoading}
                        newComment={newComment}
                        setNewComment={setNewComment}
                        commentInputRef={commentInputRef}
                        commentSubmitting={commentSubmitting}
                        handleCreateComment={handleCreateComment}
                        editingCommentId={editingCommentId}
                        setEditingCommentId={setEditingCommentId}
                        editingCommentText={editingCommentText}
                        setEditingCommentText={setEditingCommentText}
                        handleUpdateComment={handleUpdateComment}
                        handleDeleteComment={handleDeleteComment}
                        handleToggleReaction={handleToggleReaction}
                        viewMode="calendar"
                    />
                </Box>
            )}


            {/* Create / Edit Modal */}
            <Modal
                opened={showCreateModal}
                onClose={() => { setShowCreateModal(false); setDuplicateWarning(null); resetForm(); }}
                title={
                    <Group gap="xs">
                        <IconCalendarEvent size={20} color="#228be6" />
                        <Text fw={600}>{editingCompetition ? '대회 수정' : '대회 등록'}</Text>
                    </Group>
                }
                size="lg"
            >
                <Stack gap="sm">
                    <Select
                        label="대회 유형"
                        required
                        data={ALL_COMPETITION_TYPES.map(t => ({ value: t, label: COMPETITION_TYPE_LABELS[t] }))}
                        value={formType}
                        onChange={v => v && setFormType(v as CompetitionType)}
                    />
                    <TextInput label="대회명" required placeholder="예: 서울국제마라톤" value={formName} onChange={e => setFormName(e.target.value)} />
                    <TextInput label="약어" placeholder="예: 서울마" value={formAbbr} onChange={e => setFormAbbr(e.target.value)} />
                    <Group grow>
                        <TextInput
                            label="시작일" required type="date" value={formStartDate}
                            onChange={e => {
                                setFormStartDate(e.target.value);
                                if (!formEndDate || formEndDate < e.target.value) setFormEndDate(e.target.value);
                            }}
                        />
                        <TextInput label="종료일" required type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} min={formStartDate} />
                    </Group>
                    <TextInput label="출발시간" type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} />
                    <TextInput label="장소" required placeholder="예: 서울 광화문" leftSection={<IconMapPin size={16} />} value={formLocation} onChange={e => setFormLocation(e.target.value)} />
                    <TextInput label="홈페이지 URL" placeholder="https://..." leftSection={<IconLink size={16} />} value={formUrl} onChange={e => setFormUrl(e.target.value)} />
                    <Textarea label="메모" placeholder="기타 참고사항" value={formMemo} onChange={e => setFormMemo(e.target.value)} autosize minRows={2} />

                    {/* Registration Periods Section */}
                    <Divider my="xs" label={<Group gap={4}><IconTicket size={14} /><Text size="sm" fw={500}>신청일시</Text></Group>} labelPosition="left" />

                    {/* Existing registration periods (edit mode) */}
                    {existingRegPeriods.length > 0 && (
                        <Stack gap={4}>
                            {existingRegPeriods.map(rp => (
                                <Group key={rp.id} gap="xs" align="center" style={{ background: 'var(--mantine-color-gray-0)', padding: '6px 8px', borderRadius: 6 }}>
                                    <Badge size="sm" variant="light">{rp.category_name}</Badge>
                                    <Text size="xs">{dayjs(rp.registration_date).format('YYYY.M.D')}</Text>
                                    {rp.registration_time && <Text size="xs" c="dimmed">{rp.registration_time}~</Text>}
                                    <ActionIcon size="xs" variant="subtle" color="red" onClick={() => handleDeleteRegPeriod(rp.id)}>
                                        <IconTrash size={12} />
                                    </ActionIcon>
                                </Group>
                            ))}
                        </Stack>
                    )}

                    {/* New registration period rows */}
                    {regPeriodForms.map((rp, idx) => (
                        <Group key={idx} gap="xs" align="flex-end">
                            <TextInput
                                label={idx === 0 ? '종목' : undefined}
                                placeholder="풀코스, 하프, 10km 등"
                                value={rp.category_name}
                                onChange={e => updateRegPeriodRow(idx, 'category_name', e.target.value)}
                                style={{ flex: 1 }}
                                size="xs"
                            />
                            <TextInput
                                label={idx === 0 ? '신청일자' : undefined}
                                type="date"
                                value={rp.registration_date}
                                onChange={e => updateRegPeriodRow(idx, 'registration_date', e.target.value)}
                                style={{ flex: 0.8 }}
                                size="xs"
                            />
                            <TextInput
                                label={idx === 0 ? '시작시간' : undefined}
                                type="time"
                                value={rp.registration_time}
                                onChange={e => updateRegPeriodRow(idx, 'registration_time', e.target.value)}
                                style={{ flex: 0.6 }}
                                size="xs"
                            />
                            <ActionIcon variant="subtle" color="red" onClick={() => removeRegPeriodRow(idx)} size="sm">
                                <IconTrash size={14} />
                            </ActionIcon>
                        </Group>
                    ))}

                    <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={addRegPeriodRow}
                        style={{ alignSelf: 'flex-start' }}
                    >
                        신청일시 추가
                    </Button>

                    {duplicateWarning && (
                        <Paper p="sm" radius="md" bg="yellow.0" style={{ border: '1px solid var(--mantine-color-yellow-4)' }}>
                            <Text size="sm" c="orange.8" fw={500}>⚠️ {duplicateWarning}</Text>
                            <Group mt="xs" gap="xs">
                                <Button size="xs" variant="light" color="orange" onClick={handleForceCreate} loading={formSubmitting}>
                                    그래도 등록
                                </Button>
                                <Button size="xs" variant="subtle" onClick={() => setDuplicateWarning(null)}>취소</Button>
                            </Group>
                        </Paper>
                    )}

                    {!duplicateWarning && (
                        <Group justify="flex-end" mt="md">
                            <Button variant="subtle" onClick={() => { setShowCreateModal(false); setDuplicateWarning(null); resetForm(); }}>
                                취소
                            </Button>
                            <Button
                                variant="gradient"
                                gradient={{ from: 'blue', to: 'cyan' }}
                                onClick={handleSave}
                                loading={formSubmitting}
                            >
                                {editingCompetition ? '수정하기' : '등록하기'}
                            </Button>
                        </Group>
                    )}
                </Stack>
            </Modal>
        </Container>
    );
}
