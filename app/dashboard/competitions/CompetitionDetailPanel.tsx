import {
    Group, ActionIcon, Button, Text, Paper, Badge, Title,
    Textarea, Avatar, Tooltip, Divider, Stack, Anchor, CloseButton,
    LoadingOverlay, Box, Table, Popover,
} from '@mantine/core';
import {
    IconInfoCircle, IconEdit, IconTrash, IconCalendarDue, IconClock,
    IconMapPin, IconLink, IconNote, IconUser, IconTicket, IconCheck,
    IconHandStop, IconMessage, IconMoodSmile, IconSend
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { Competition, CompetitionComment, UserProfile } from '@/types';
import { COMPETITION_TYPE_LABELS, COMPETITION_TYPE_COLORS, AVAILABLE_REACTIONS } from '@/lib/competitions';
import styles from './CompetitionCalendar.module.css';

interface CompetitionDetailPanelProps {
    selectedCompetition: Competition;
    detailLoading: boolean;
    currentUser: UserProfile | null;
    isAdmin: boolean;
    canEditDelete: (comp: Competition) => boolean;
    handleOpenEdit: (comp: Competition) => void;
    handleDeleteCompetition: (comp: Competition) => void;
    setSelectedCompetition: (comp: Competition | null) => void;
    isParticipating: boolean;
    handleParticipate: () => void;
    comments: CompetitionComment[];
    commentsLoading: boolean;
    newComment: string;
    setNewComment: (str: string) => void;
    commentInputRef: React.RefObject<HTMLTextAreaElement | null>;
    commentSubmitting: boolean;
    handleCreateComment: () => void;
    editingCommentId: string | null;
    setEditingCommentId: (id: string | null) => void;
    editingCommentText: string;
    setEditingCommentText: (txt: string) => void;
    handleUpdateComment: (id: string) => void;
    handleDeleteComment: (id: string) => void;
    handleToggleReaction: (commentId: string, emoji: string) => void;
    viewMode?: 'calendar' | 'list';
}

export default function CompetitionDetailPanel(props: CompetitionDetailPanelProps) {
    const {
        selectedCompetition, detailLoading, currentUser, canEditDelete, handleOpenEdit,
        handleDeleteCompetition, setSelectedCompetition, isParticipating, handleParticipate,
        comments, commentsLoading, newComment, setNewComment, commentInputRef, commentSubmitting,
        handleCreateComment, editingCommentId, setEditingCommentId, editingCommentText,
        setEditingCommentText, handleUpdateComment, handleDeleteComment, handleToggleReaction,
        viewMode = 'calendar'
    } = props;

    return (
        <Paper shadow={viewMode === 'calendar' ? "sm" : "none"} radius="md" p={viewMode === 'calendar' ? "sm" : 0} mt={viewMode === 'calendar' ? "sm" : 0} className={viewMode === 'calendar' ? styles.detailPanel : ''} pos="relative">
            <LoadingOverlay visible={detailLoading} loaderProps={{ type: 'dots' }} />
            <Group justify="space-between" mb="xs">
                <Group gap="sm">
                    <Badge size="lg" color={COMPETITION_TYPE_COLORS[selectedCompetition.competition_type]}>
                        {COMPETITION_TYPE_LABELS[selectedCompetition.competition_type]}
                    </Badge>
                    <Title order={4}>{selectedCompetition.name}</Title>
                    {selectedCompetition.abbreviation && (
                        <Text c="dimmed" size="sm">({selectedCompetition.abbreviation})</Text>
                    )}
                </Group>
                <Group gap={4}>
                    {canEditDelete(selectedCompetition) && (
                        <>
                            <Tooltip label="수정">
                                <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenEdit(selectedCompetition)} size="md">
                                    <IconEdit size={18} />
                                </ActionIcon>
                            </Tooltip>
                            <Tooltip label="삭제">
                                <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteCompetition(selectedCompetition)} size="md">
                                    <IconTrash size={18} />
                                </ActionIcon>
                            </Tooltip>
                        </>
                    )}
                    {viewMode === 'calendar' && (
                        <CloseButton onClick={() => setSelectedCompetition(null)} />
                    )}
                </Group>
            </Group>

            <div className={styles.detailGrid}>
                <dl className={styles.detailField}>
                    <dt><IconCalendarDue size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 기간</dt>
                    <dd>
                        {selectedCompetition.start_date === selectedCompetition.end_date
                            ? dayjs(selectedCompetition.start_date).format('YYYY년 M월 D일')
                            : `${dayjs(selectedCompetition.start_date).format('YYYY.M.D')} ~ ${dayjs(selectedCompetition.end_date).format('YYYY.M.D')}`
                        }
                    </dd>
                </dl>
                {selectedCompetition.start_time && (
                    <dl className={styles.detailField}>
                        <dt><IconClock size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 출발시간</dt>
                        <dd>{selectedCompetition.start_time}</dd>
                    </dl>
                )}
                <dl className={styles.detailField}>
                    <dt><IconMapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 장소</dt>
                    <dd>{selectedCompetition.location}</dd>
                </dl>
                {selectedCompetition.homepage_url && (
                    <dl className={styles.detailField}>
                        <dt><IconLink size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 홈페이지</dt>
                        <dd>
                            <Anchor href={selectedCompetition.homepage_url} target="_blank" size="sm">
                                {selectedCompetition.homepage_url}
                            </Anchor>
                        </dd>
                    </dl>
                )}
                {selectedCompetition.memo && (
                    <dl className={styles.detailField}>
                        <dt><IconNote size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 메모</dt>
                        <dd style={{ whiteSpace: 'pre-wrap' }}>{selectedCompetition.memo}</dd>
                    </dl>
                )}
                <dl className={styles.detailField}>
                    <dt><IconUser size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 등록자</dt>
                    <dd>
                        <Group gap={4}>
                            <Avatar size={20} radius="xl" src={selectedCompetition.registrant?.avatar_url} color="blue">
                                {selectedCompetition.registrant?.nickname?.charAt(0)}
                            </Avatar>
                            <Text size="sm">{selectedCompetition.registrant?.nickname}</Text>
                        </Group>
                    </dd>
                </dl>
            </div>

            {selectedCompetition.registration_periods && selectedCompetition.registration_periods.length > 0 && (
                <>
                    <Divider my="xs" />
                    <Text fw={600} size="sm" mb="xs">
                        <IconTicket size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 신청일시
                    </Text>
                    <Table withTableBorder withColumnBorders>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>종목</Table.Th>
                                <Table.Th>신청일자</Table.Th>
                                <Table.Th>시작시간</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {selectedCompetition.registration_periods.map(rp => (
                                <Table.Tr key={rp.id}>
                                    <Table.Td>{rp.category_name}</Table.Td>
                                    <Table.Td>{dayjs(rp.registration_date).format('YYYY.M.D')}</Table.Td>
                                    <Table.Td>{rp.registration_time || '-'}</Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </>
            )}

            <Divider my="xs" />

            <Group justify="space-between" align="flex-start">
                <div>
                    <Text fw={600} size="sm" mb={4}>
                        참가자 ({selectedCompetition.participants?.length || 0}명)
                    </Text>
                    <div className={styles.participantsList}>
                        {selectedCompetition.participants?.map(p => (
                            <Tooltip key={p.id} label={p.user?.nickname}>
                                <div className={styles.participantItem}>
                                    <Avatar size={36} radius="xl" src={p.user?.avatar_url} color="blue">
                                        {p.user?.nickname?.charAt(0)}
                                    </Avatar>
                                    <Text size="xs">{p.user?.nickname}</Text>
                                </div>
                            </Tooltip>
                        ))}
                        {(!selectedCompetition.participants || selectedCompetition.participants.length === 0) && (
                            <Text size="sm" c="dimmed">아직 참가자가 없습니다.</Text>
                        )}
                    </div>
                </div>
                <Button
                    variant={isParticipating ? 'light' : 'gradient'}
                    gradient={!isParticipating ? { from: 'orange', to: 'yellow' } : undefined}
                    color={isParticipating ? 'gray' : undefined}
                    leftSection={isParticipating ? <IconCheck size={18} /> : <IconHandStop size={18} />}
                    onClick={handleParticipate}
                    size="md"
                >
                    {isParticipating ? '참가 취소' : '나 참가! ✋'}
                </Button>
            </Group>

            <Divider my="xs" />
            <Text fw={600} size="sm" mb={4}>
                <IconMessage size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 댓글 ({comments.length})
            </Text>

            <Stack gap="sm" mb="md">
                {commentsLoading ? (
                    <Text size="sm" c="dimmed" ta="center">댓글을 불러오는 중...</Text>
                ) : comments.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!</Text>
                ) : (
                    comments.map(comment => {
                        const isOwn = comment.user_id === currentUser?.id;
                        const isEditing = editingCommentId === comment.id;

                        const reactionGroups: { emoji: string; count: number; userReacted: boolean }[] = [];
                        if (comment.reactions) {
                            const emojiMap = new Map<string, { count: number; userReacted: boolean }>();
                            for (const r of comment.reactions) {
                                const existing = emojiMap.get(r.emoji);
                                if (existing) {
                                    existing.count++;
                                    if (r.user_id === currentUser?.id) existing.userReacted = true;
                                } else {
                                    emojiMap.set(r.emoji, { count: 1, userReacted: r.user_id === currentUser?.id });
                                }
                            }
                            emojiMap.forEach((val, emoji) => reactionGroups.push({ emoji, ...val }));
                        }

                        return (
                            <Paper key={comment.id} p="sm" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-gray-2)' }}>
                                <Group justify="space-between" mb={4}>
                                    <Group gap={8}>
                                        <Avatar size={28} radius="xl" src={comment.user?.avatar_url} color="blue">
                                            {comment.user?.nickname?.charAt(0)}
                                        </Avatar>
                                        <div>
                                            <Text size="sm" fw={600} lh={1.2}>{comment.user?.nickname}</Text>
                                            <Text size="xs" c="dimmed">
                                                {dayjs(comment.created_at).format('M/D HH:mm')}
                                                {comment.updated_at !== comment.created_at && ' (수정됨)'}
                                            </Text>
                                        </div>
                                    </Group>
                                    {isOwn && (
                                        <Group gap={2}>
                                            <ActionIcon variant="subtle" size="xs" color="gray" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); }}>
                                                <IconEdit size={14} />
                                            </ActionIcon>
                                            <ActionIcon variant="subtle" size="xs" color="red" onClick={() => handleDeleteComment(comment.id)}>
                                                <IconTrash size={14} />
                                            </ActionIcon>
                                        </Group>
                                    )}
                                </Group>

                                {isEditing ? (
                                    <Group gap="xs" mt={4}>
                                        <Textarea value={editingCommentText} onChange={e => setEditingCommentText(e.target.value)} autosize minRows={1} maxRows={4} style={{ flex: 1 }} size="xs" />
                                        <Button size="xs" variant="filled" onClick={() => handleUpdateComment(comment.id)}>저장</Button>
                                        <Button size="xs" variant="subtle" color="gray" onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }}>취소</Button>
                                    </Group>
                                ) : (
                                    <Text size="sm" mt={4} style={{ whiteSpace: 'pre-wrap' }}>{comment.content}</Text>
                                )}

                                <Group gap={4} mt={6}>
                                    {reactionGroups.map(rg => (
                                        <Badge
                                            key={rg.emoji} variant={rg.userReacted ? 'filled' : 'light'} color={rg.userReacted ? 'blue' : 'gray'}
                                            size="sm" style={{ cursor: 'pointer', padding: '2px 6px' }}
                                            onClick={() => handleToggleReaction(comment.id, rg.emoji)}
                                        >
                                            {rg.emoji} {rg.count}
                                        </Badge>
                                    ))}
                                    <Popover position="top" withArrow shadow="sm" width={200}>
                                        <Popover.Target>
                                            <ActionIcon variant="subtle" size="xs" color="gray">
                                                <IconMoodSmile size={16} />
                                            </ActionIcon>
                                        </Popover.Target>
                                        <Popover.Dropdown p={8}>
                                            <Group gap={4} justify="center">
                                                {AVAILABLE_REACTIONS.map(emoji => (
                                                    <ActionIcon key={emoji} variant="subtle" size="lg" onClick={() => handleToggleReaction(comment.id, emoji)} style={{ fontSize: '1.2rem' }}>
                                                        {emoji}
                                                    </ActionIcon>
                                                ))}
                                            </Group>
                                        </Popover.Dropdown>
                                    </Popover>
                                </Group>
                            </Paper>
                        );
                    })
                )}
            </Stack>

            <Group gap="xs" align="flex-end">
                <Avatar size={32} radius="xl" src={currentUser?.avatar_url} color="blue">
                    {currentUser?.nickname?.charAt(0)}
                </Avatar>
                <Textarea
                    ref={commentInputRef as any}
                    placeholder="댓글을 입력하세요..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCreateComment();
                        }
                    }}
                    autosize
                    minRows={1}
                    maxRows={4}
                    style={{ flex: 1 }}
                    size="sm"
                />
                <ActionIcon variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} size="lg" onClick={handleCreateComment} loading={commentSubmitting} disabled={!newComment.trim()}>
                    <IconSend size={18} />
                </ActionIcon>
            </Group>
        </Paper>
    );
}
