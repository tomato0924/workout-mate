'use client';

import { useEffect, useState } from 'react';
import {
    Table, Button, Group, Text, Badge, ActionIcon, Modal, TextInput,
    Select, Textarea, Stack, Paper, Title, LoadingOverlay, Tooltip,
    FileInput, Alert, Code,
} from '@mantine/core';
import {
    IconPlus, IconTrash, IconEdit, IconUpload, IconDownload,
    IconAlertCircle, IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { createClient } from '@/lib/supabase/client';
import type { Competition, CompetitionType } from '@/types';
import {
    COMPETITION_TYPE_LABELS,
    COMPETITION_TYPE_COLORS,
    ALL_COMPETITION_TYPES,
    fetchCompetitions,
    createCompetition,
    forceCreateCompetition,
    updateCompetition,
    deleteCompetition,
} from '@/lib/competitions';
import dayjs from 'dayjs';

export function AdminCompetitions() {
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);
    const [editModal, setEditModal] = useState(false);
    const [editingComp, setEditingComp] = useState<Competition | null>(null);
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkResult, setBulkResult] = useState<{ message: string; success: number; errors: { row: number; reason: string }[] } | null>(null);
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

    const loadAll = async () => {
        setLoading(true);
        // Load all competitions (wide date range)
        const now = new Date();
        const data = await fetchCompetitions(now.getFullYear(), now.getMonth() + 1, ALL_COMPETITION_TYPES);
        // Also fetch future months
        const future1 = await fetchCompetitions(now.getFullYear(), now.getMonth() + 2, ALL_COMPETITION_TYPES);
        const future2 = await fetchCompetitions(now.getFullYear(), now.getMonth() + 3, ALL_COMPETITION_TYPES);
        const past1 = await fetchCompetitions(now.getFullYear(), now.getMonth(), ALL_COMPETITION_TYPES);

        const allCompetitions = [...past1, ...data, ...future1, ...future2];
        // Deduplicate by id
        const unique = Array.from(new Map(allCompetitions.map(c => [c.id, c])).values());
        unique.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

        setCompetitions(unique);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, []);

    const openCreate = () => {
        setEditingComp(null);
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
        setEditModal(true);
    };

    const openEdit = (comp: Competition) => {
        setEditingComp(comp);
        setFormType(comp.competition_type);
        setFormName(comp.name);
        setFormAbbr(comp.abbreviation || '');
        setFormStartDate(comp.start_date);
        setFormEndDate(comp.end_date);
        setFormStartTime(comp.start_time || '');
        setFormLocation(comp.location);
        setFormUrl(comp.homepage_url || '');
        setFormMemo(comp.memo || '');
        setDuplicateWarning(null);
        setEditModal(true);
    };

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

        if (editingComp) {
            const result = await updateCompetition(editingComp.id, payload);
            setFormSubmitting(false);
            if (result.error) {
                notifications.show({ title: '오류', message: result.error, color: 'red' });
                return;
            }
        } else {
            const result = await createCompetition(payload);
            setFormSubmitting(false);
            if (result.duplicateWarning) {
                setDuplicateWarning(result.duplicateWarning);
                return;
            }
            if (result.error) {
                notifications.show({ title: '오류', message: result.error, color: 'red' });
                return;
            }
        }

        notifications.show({ title: '완료', message: editingComp ? '수정되었습니다.' : '등록되었습니다.', color: 'teal' });
        setEditModal(false);
        loadAll();
    };

    const handleForceCreate = async () => {
        setFormSubmitting(true);
        const result = await forceCreateCompetition({
            competition_type: formType,
            name: formName,
            abbreviation: formAbbr || undefined,
            start_date: formStartDate,
            end_date: formEndDate || formStartDate,
            start_time: formStartTime || undefined,
            location: formLocation,
            homepage_url: formUrl || undefined,
            memo: formMemo || undefined,
        });
        setFormSubmitting(false);
        if (result.error) {
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        notifications.show({ title: '완료', message: '등록되었습니다.', color: 'teal' });
        setEditModal(false);
        setDuplicateWarning(null);
        loadAll();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const result = await deleteCompetition(id);
        if (result.error) {
            notifications.show({ title: '오류', message: result.error, color: 'red' });
            return;
        }
        notifications.show({ title: '삭제 완료', message: '대회가 삭제되었습니다.', color: 'teal' });
        loadAll();
    };

    // Bulk import
    const handleBulkImport = async () => {
        if (!bulkFile) return;

        setBulkLoading(true);
        setBulkResult(null);

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                notifications.show({ title: '오류', message: '인증이 필요합니다.', color: 'red' });
                setBulkLoading(false);
                return;
            }

            const formData = new FormData();
            formData.append('file', bulkFile);

            const res = await fetch('/api/admin/competitions/bulk-import', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            const result = await res.json();
            if (!res.ok) {
                notifications.show({ title: '오류', message: result.error, color: 'red' });
            } else {
                setBulkResult(result);
                notifications.show({ title: '완료', message: result.message, color: 'teal' });
                loadAll();
            }
        } catch (error) {
            notifications.show({ title: '오류', message: '업로드 중 오류가 발생했습니다.', color: 'red' });
        }

        setBulkLoading(false);
    };

    // Download sample template
    const downloadTemplate = () => {
        const headers = 'competition_type,name,abbreviation,start_date,end_date,start_time,location,homepage_url,memo\n';
        const sample1 = 'marathon,서울국제마라톤,서울마,2026-03-15,2026-03-15,08:00,서울 광화문,https://seoul-marathon.com,풀/하프 코스\n';
        const sample2 = 'triathlon,통영 트라이애슬론,통영트라이,2026-06-20,2026-06-21,07:00,경남 통영,,올림픽 디스턴스\n';
        const sample3 = 'trail_run,지리산 트레일런,,2026-09-05,2026-09-05,06:00,전남 구례,,50km/30km\n';

        const csvContent = headers + sample1 + sample2 + sample3;
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'competition_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Stack gap="lg" pos="relative">
            <LoadingOverlay visible={loading} loaderProps={{ type: 'dots' }} />

            {/* Management section */}
            <Paper shadow="xs" p="md" radius="md">
                <Group justify="space-between" mb="md">
                    <Title order={4}>📋 대회 목록</Title>
                    <Button leftSection={<IconPlus size={16} />} onClick={openCreate} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} size="sm">
                        대회 등록
                    </Button>
                </Group>

                <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>유형</Table.Th>
                            <Table.Th>대회명</Table.Th>
                            <Table.Th>기간</Table.Th>
                            <Table.Th>장소</Table.Th>
                            <Table.Th>참가</Table.Th>
                            <Table.Th>관리</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {competitions.map(comp => (
                            <Table.Tr key={comp.id}>
                                <Table.Td>
                                    <Badge color={COMPETITION_TYPE_COLORS[comp.competition_type]} size="sm">
                                        {COMPETITION_TYPE_LABELS[comp.competition_type]}
                                    </Badge>
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm" fw={500}>{comp.name}</Text>
                                    {comp.abbreviation && <Text size="xs" c="dimmed">{comp.abbreviation}</Text>}
                                </Table.Td>
                                <Table.Td>
                                    <Text size="sm">
                                        {comp.start_date === comp.end_date
                                            ? dayjs(comp.start_date).format('YY/MM/DD')
                                            : `${dayjs(comp.start_date).format('YY/MM/DD')} ~ ${dayjs(comp.end_date).format('YY/MM/DD')}`
                                        }
                                    </Text>
                                </Table.Td>
                                <Table.Td><Text size="sm">{comp.location}</Text></Table.Td>
                                <Table.Td>
                                    <Badge variant="outline" size="sm">{comp.participants?.length || 0}명</Badge>
                                </Table.Td>
                                <Table.Td>
                                    <Group gap={4}>
                                        <Tooltip label="수정">
                                            <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(comp)} size="sm">
                                                <IconEdit size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Tooltip label="삭제">
                                            <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(comp.id)} size="sm">
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                        {competitions.length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={6}>
                                    <Text ta="center" c="dimmed" py="lg">등록된 대회가 없습니다.</Text>
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>
            </Paper>

            {/* Bulk import section */}
            <Paper shadow="xs" p="md" radius="md">
                <Title order={4} mb="md">📥 일괄 등록 (CSV/Excel)</Title>

                <Group align="flex-end" gap="md" mb="md">
                    <FileInput
                        label="파일 선택"
                        placeholder=".csv 또는 .xlsx 파일"
                        accept=".csv,.xlsx,.xls"
                        value={bulkFile}
                        onChange={setBulkFile}
                        leftSection={<IconUpload size={16} />}
                        style={{ flex: 1 }}
                    />
                    <Button
                        onClick={handleBulkImport}
                        loading={bulkLoading}
                        disabled={!bulkFile}
                        variant="gradient"
                        gradient={{ from: 'teal', to: 'green' }}
                    >
                        업로드 및 등록
                    </Button>
                </Group>

                <Button
                    variant="light"
                    leftSection={<IconDownload size={16} />}
                    size="xs"
                    onClick={downloadTemplate}
                >
                    샘플 템플릿 다운로드 (CSV)
                </Button>

                <Text size="xs" c="dimmed" mt="xs">
                    지원 컬럼: competition_type(대회유형), name(대회명), abbreviation(약어), start_date(시작일), end_date(종료일), start_time(출발시간), location(장소), homepage_url(홈페이지), memo(메모)
                </Text>

                {bulkResult && (
                    <Alert
                        mt="md"
                        color={bulkResult.errors.length > 0 ? 'yellow' : 'teal'}
                        icon={bulkResult.errors.length > 0 ? <IconAlertCircle size={16} /> : <IconCheck size={16} />}
                        title={bulkResult.message}
                    >
                        {bulkResult.errors.length > 0 && (
                            <Stack gap={4} mt="xs">
                                {bulkResult.errors.map((err, i) => (
                                    <Text key={i} size="xs">행 {err.row}: {err.reason}</Text>
                                ))}
                            </Stack>
                        )}
                    </Alert>
                )}
            </Paper>

            {/* Edit/Create Modal */}
            <Modal
                opened={editModal}
                onClose={() => { setEditModal(false); setDuplicateWarning(null); }}
                title={<Text fw={600}>{editingComp ? '대회 수정' : '대회 등록'}</Text>}
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
                    <TextInput label="대회명" required value={formName} onChange={e => setFormName(e.target.value)} />
                    <TextInput label="약어" value={formAbbr} onChange={e => setFormAbbr(e.target.value)} />
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
                    <TextInput label="장소" required value={formLocation} onChange={e => setFormLocation(e.target.value)} />
                    <TextInput label="홈페이지 URL" value={formUrl} onChange={e => setFormUrl(e.target.value)} />
                    <Textarea label="메모" value={formMemo} onChange={e => setFormMemo(e.target.value)} autosize minRows={2} />

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
                            <Button variant="subtle" onClick={() => { setEditModal(false); setDuplicateWarning(null); }}>취소</Button>
                            <Button variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} onClick={handleSave} loading={formSubmitting}>
                                {editingComp ? '수정하기' : '등록하기'}
                            </Button>
                        </Group>
                    )}
                </Stack>
            </Modal>
        </Stack>
    );
}
