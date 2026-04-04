const fs = require('fs');

const path = 'app/dashboard/competitions/page.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\\n').map(l => l.replace('\\r', ''));

// Chunk 4: Import
const importIdx = lines.findIndex(l => l.includes("import styles from './CompetitionCalendar.module.css';"));
lines.splice(importIdx + 1, 0, "import CompetitionDetailPanel from './CompetitionDetailPanel';");

// Chunk 1: Calendar Header (lines around 634-638, now shifted due to import)
const calendarHeaderIdx = lines.findIndex(l => l.includes('{/* Calendar Section */}'));
// find </Group> after it
const calendarHeaderEndIdx = lines.findIndex((l, i) => i > calendarHeaderIdx && l.includes('</Group>'));

const chunk1 = `            {/* View Mode & Title */}
            <Group justify="space-between" align="center" mt="lg" mb="xs">
                <Group gap="xs">
                    {viewMode === 'calendar' ? (
                        <IconCalendar size={20} color="var(--mantine-color-dimmed)" />
                    ) : (
                        <IconList size={20} color="var(--mantine-color-dimmed)" />
                    )}
                    <Text fw={600} size="sm" c="dimmed">
                        {viewMode === 'calendar' ? '대회 캘린더' : '대회 목록'}
                    </Text>
                </Group>
                <SegmentedControl
                    value={viewMode}
                    onChange={(val) => setViewMode(val)}
                    data={[
                        { label: '캘린더 보기', value: 'calendar' },
                        { label: '목록 보기', value: 'list' },
                    ]}
                    size="xs"
                />
            </Group>

            {viewMode === 'calendar' && (`;

lines.splice(calendarHeaderIdx, calendarHeaderEndIdx - calendarHeaderIdx + 1, chunk1);

// Chunk 2: End of Calendar (around line 779, but shifted)
const calendarEndIdx = lines.findIndex((l, i) => i > calendarHeaderIdx && l.includes('</Paper>') && lines[i-1].includes('</div>'));

const chunk2 = `            </Paper>
            )}

            {viewMode === 'list' && (
                <Stack gap="sm">
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
                                                handleEventClick(comp);
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
                                                selectedCompetition={selectedCompetition}
                                                detailLoading={detailLoading}
                                                currentUser={currentUser}
                                                isAdmin={isAdmin}
                                                canEditDelete={canEditDelete}
                                                handleOpenEdit={handleOpenEdit}
                                                handleDeleteCompetition={handleDeleteCompetition}
                                                setSelectedCompetition={setSelectedCompetition}
                                                isParticipating={isCompParticipating}
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
            )}`;

lines.splice(calendarEndIdx, 1, chunk2);

// Chunk 3: Detail Panel deletion (lines around 781-1109, shifted)
const detailStartIdx = lines.findIndex(l => l.includes('{/* Competition Detail Section */}'));
const detailEndIdx = lines.findIndex((l, i) => i > detailStartIdx && l.includes('{/* Create / Edit Modal */}'));

const chunk3 = `            {/* Competition Detail Section */}
            {viewMode === 'calendar' && selectedCompetition && (
                <CompetitionDetailPanel
                    selectedCompetition={selectedCompetition}
                    detailLoading={detailLoading}
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    canEditDelete={canEditDelete}
                    handleOpenEdit={handleOpenEdit}
                    handleDeleteCompetition={handleDeleteCompetition}
                    setSelectedCompetition={setSelectedCompetition}
                    isParticipating={isParticipating}
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
            )}

`;

// Note: from detailStartIdx to the line BEFORE detailEndIdx
lines.splice(detailStartIdx, detailEndIdx - detailStartIdx, chunk3);

fs.writeFileSync(path, lines.join('\\n'));
console.log('SUCCESS');
