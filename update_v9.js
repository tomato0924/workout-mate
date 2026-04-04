const fs = require('fs');
const path = 'app/dashboard/competitions/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const isCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

try {
    // 1. Add IconList
    content = content.replace(
        "IconMessage, IconMoodSmile, IconSend, IconCalendar, IconFilter, IconInfoCircle, IconPencil,",
        "IconMessage, IconMoodSmile, IconSend, IconCalendar, IconFilter, IconInfoCircle, IconPencil, IconList,"
    );

    // 1-b Add SegmentedControl
    content = content.replace(
        "Divider, Stack, Anchor, CloseButton, LoadingOverlay, Box, Table,\n    Popover,",
        "Divider, Stack, Anchor, CloseButton, LoadingOverlay, Box, Table,\n    Popover, SegmentedControl,"
    );

    // 2. Add DetailPanel import with actual newline!
    content = content.replace(
        "import styles from './CompetitionCalendar.module.css';",
        "import styles from './CompetitionCalendar.module.css';\nimport CompetitionDetailPanel from './CompetitionDetailPanel';"
    );

    // 3. Add viewMode state
    content = content.replace(
        "const [loading, setLoading] = useState(true);\n    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);",
        "const [loading, setLoading] = useState(true);\n    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');\n    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);"
    );

    // 4. Chunk 1: Header switch
    const calendarHeaderStart = content.indexOf('            {/* Calendar Section */}');
    const calendarHeaderEndStr = '            <Paper shadow="sm" radius="md" p="md" pos="relative"';
    const calendarHeaderEnd = content.indexOf(calendarHeaderEndStr, calendarHeaderStart);

    // USING IconCalendarEvent because IconCalendar is buggy/missing in some @tabler/icons-react setups despite what the import says.
    const chunk1 = `            {/* View Mode & Title */}
            <Group justify="space-between" align="center" mt="lg" mb="xs">
                <Group gap="xs">
                    {viewMode === 'calendar' ? (
                        <IconCalendarEvent size={20} color="var(--mantine-color-dimmed)" />
                    ) : (
                        <IconList size={20} color="var(--mantine-color-dimmed)" />
                    )}
                    <Text fw={600} size="sm" c="dimmed">
                        {viewMode === 'calendar' ? '대회 캘린더' : '대회 목록'}
                    </Text>
                </Group>
                <SegmentedControl
                    value={viewMode}
                    onChange={(val) => setViewMode(val as 'calendar' | 'list')}
                    data={[
                        { label: '캘린더 보기', value: 'calendar' },
                        { label: '목록 보기', value: 'list' },
                    ]}
                    size="xs"
                />
            </Group>

            {viewMode === 'calendar' && (
${calendarHeaderEndStr}`;

    content = content.substring(0, calendarHeaderStart) + chunk1 + content.substring(calendarHeaderEnd + calendarHeaderEndStr.length);

    // 5. Chunk 2: From Calendar End to Modal Start
    const detailSectionStr = '            {/* Competition Detail Section */}';
    let detailSectionIdx = content.indexOf(detailSectionStr);
    
    let paperEndIdx = content.lastIndexOf('            </Paper>', detailSectionIdx);
    let intersectionIndex = paperEndIdx + '            </Paper>'.length;

    const modalStr = '            {/* Create / Edit Modal */}';
    const modalStartIndex = content.lastIndexOf(modalStr);

    const chunk2 = `
            )}

            {viewMode === 'list' && (
                <Stack gap="sm" mt="lg">
                    {competitions.length === 0 ? (
                        <Paper shadow="sm" radius="md" p="xl" ta="center">
                            <Text c="dimmed">해당 조건의 대회가 없습니다.</Text>
                        </Paper>
                    ) : (
                        competitions.map((comp) => {
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
                                            <div style={{ minWidth: 60, textAlign: 'center' }}>
                                                <Text size="lg" fw={700}>
                                                    {dayjs(comp.start_date).format('D')}
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
                        })
                    )}
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
`;

    if (intersectionIndex === -1 || modalStartIndex === -1 || calendarHeaderStart === -1 || calendarHeaderEnd === -1 || detailSectionIdx === -1) {
        throw new Error("Missing indexes");
    }

    content = content.substring(0, intersectionIndex) + chunk2 + '\n\n' + content.substring(modalStartIndex);

    if (isCrlf) content = content.replace(/\n/g, '\r\n');

    fs.writeFileSync(path, content);
    console.log("SUCCESS!");

} catch (err) {
    console.error(err);
}
