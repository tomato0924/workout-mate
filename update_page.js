const fs = require('fs');
const path = 'app/dashboard/competitions/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const isCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. imports
content = content.replace(
    "SegmentedControl,",
    "Tabs,"
);

content = content.replace(
    "fetchCompetitions,",
    "fetchCompetitions,\n    fetchCompetitionsForYear,"
);

// 2. add listYear state
content = content.replace(
    "const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');\n    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);",
    "const [viewMode, setViewMode] = useState<string | null>('calendar');\n    const [listYear, setListYear] = useState(new Date().getFullYear());\n    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);"
);

// 3. update loadCompetitions
const loadStartStr = "const loadCompetitions = useCallback(async () => {\n        setLoading(true);";
const replaceLoadLoad = `const loadCompetitions = useCallback(async () => {
        setLoading(true);
        if (viewMode === 'list') {
            const data = await fetchCompetitionsForYear(listYear, activeFilters);
            setCompetitions(data);
            setRegPeriods([]);
            setLoading(false);
            return;
        }`;
content = content.replace(loadStartStr, replaceLoadLoad);

// Also need to add listYear and viewMode to dependency array of loadCompetitions
content = content.replace(
    "    }, [currentYear, currentMonth, activeFilters]);",
    "    }, [currentYear, currentMonth, listYear, activeFilters, viewMode]);"
);

// 4. Update the View Mode & Title section
const viewModeTitleStart = "            {/* View Mode & Title */}";
const calendarHeaderEndStr = "            {viewMode === 'calendar' && (";
const viewModeTitleStartIdx = content.indexOf(viewModeTitleStart);
const calendarHeaderEndIdx = content.indexOf(calendarHeaderEndStr, viewModeTitleStartIdx);

const newTabsChunk = `            {/* View Mode Tabs */}
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
                    <Text fw={600} size="sm" c="dimmed">
                        {listYear}년 대회 목록
                    </Text>
                    <Group gap="xs">
                        <Button variant="light" size="xs" onClick={() => setListYear(new Date().getFullYear())}>
                            올해
                        </Button>
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
                </Group>
            )}

`;

if (viewModeTitleStartIdx !== -1 && calendarHeaderEndIdx !== -1) {
    content = content.substring(0, viewModeTitleStartIdx) + newTabsChunk + content.substring(calendarHeaderEndIdx);
}

if (isCrlf) content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(path, content);
console.log('SUCCESS');
