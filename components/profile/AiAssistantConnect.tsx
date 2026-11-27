'use client';

import { useCallback, useEffect, useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Code, CopyButton, Group, List, Modal, Paper, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconCopy, IconKey, IconRobot, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { McpApiKey } from '@/types';

const MCP_HEADER = 'X-Workout-Mate-Key';

export function AiAssistantConnect() {
    const [keys, setKeys] = useState<McpApiKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [issueOpen, setIssueOpen] = useState(false);
    const [label, setLabel] = useState('');
    const [rawKey, setRawKey] = useState<string | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<McpApiKey | null>(null);

    const loadKeys = useCallback(async () => {
        const res = await fetch('/api/mcp-keys');
        if (res.ok) setKeys((await res.json()).keys);
    }, []);

    useEffect(() => { loadKeys(); }, [loadKeys]);

    const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp';

    const handleIssue = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/mcp-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setRawKey(data.rawKey);
            setLabel('');
            await loadKeys();
        } catch (e: any) {
            notifications.show({ title: '오류', message: e.message || '키를 발급하지 못했습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!revokeTarget) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/mcp-keys?id=${encodeURIComponent(revokeTarget.id)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            notifications.show({ message: '연결 키를 폐기했어요. 이 키로 연결된 AI 비서는 더 이상 접근할 수 없어요.', color: 'green' });
            setRevokeTarget(null);
            await loadKeys();
        } catch (e: any) {
            notifications.show({ title: '오류', message: e.message || '키를 폐기하지 못했습니다.', color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const closeIssue = () => {
        setIssueOpen(false);
        setRawKey(null);
    };

    return (
        <Paper withBorder shadow="sm" p="lg" radius="md" mt="md">
            <Group gap="xs" mb="xs">
                <IconRobot size={22} />
                <Title order={4}>AI 비서 연결</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
                카카오 PlayMCP(카카오 툴즈), ChatGPT, Claude 같은 AI 비서에게 말로 운동 기록을 남기고,
                크루 순위·대회 일정·공지를 물어볼 수 있어요.
            </Text>

            <Stack gap="xs" mb="md">
                {keys.length === 0 && <Text size="sm" c="dimmed">발급된 연결 키가 없어요.</Text>}
                {keys.map(k => (
                    <Group key={k.id} justify="space-between" wrap="nowrap">
                        <div style={{ minWidth: 0 }}>
                            <Group gap={6}>
                                <Code>{k.key_prefix}…</Code>
                                {k.label && <Badge variant="light" size="sm">{k.label}</Badge>}
                            </Group>
                            <Text size="xs" c="dimmed">
                                발급 {dayjs(k.created_at).format('YYYY.MM.DD')} ·{' '}
                                {k.last_used_at ? `최근 사용 ${dayjs(k.last_used_at).format('MM.DD HH:mm')}` : '아직 사용 안 함'}
                            </Text>
                        </div>
                        <Tooltip label="폐기">
                            <ActionIcon variant="subtle" color="red" onClick={() => setRevokeTarget(k)} aria-label="연결 키 폐기">
                                <IconTrash size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                ))}
            </Stack>

            <Button fullWidth variant="light" color="violet" leftSection={<IconKey size={18} />} onClick={() => setIssueOpen(true)}>
                연결 키 발급
            </Button>

            <Modal opened={issueOpen} onClose={closeIssue} title="AI 비서 연결 키 발급" centered>
                {!rawKey ? (
                    <Stack>
                        <TextInput
                            label="이름 (선택)"
                            placeholder="예: 카카오 툴즈"
                            maxLength={30}
                            value={label}
                            onChange={e => setLabel(e.currentTarget.value)}
                        />
                        <Text size="xs" c="dimmed">
                            이 키가 있으면 AI 비서가 내 이름으로 운동 기록을 조회하고 작성할 수 있어요. 다른 사람과 공유하지 마세요.
                        </Text>
                        <Button onClick={handleIssue} loading={loading}>발급하기</Button>
                    </Stack>
                ) : (
                    <Stack>
                        <Alert color="yellow" title="지금만 볼 수 있어요">
                            창을 닫으면 키를 다시 확인할 수 없어요. 지금 복사해서 AI 비서 설정에 붙여 넣어 주세요.
                        </Alert>
                        <Group gap="xs" wrap="nowrap">
                            <Code block style={{ flex: 1, wordBreak: 'break-all' }}>{rawKey}</Code>
                            <CopyButton value={rawKey}>
                                {({ copied, copy }) => (
                                    <ActionIcon variant="light" color={copied ? 'teal' : 'gray'} onClick={copy} aria-label="키 복사">
                                        {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                                    </ActionIcon>
                                )}
                            </CopyButton>
                        </Group>
                        <Text size="sm" fw={600}>카카오 PlayMCP에서 연결하는 방법</Text>
                        <List size="sm" type="ordered" spacing={4}>
                            <List.Item>playmcp.kakao.com에서 &quot;Workout Mate&quot;를 찾아 도구함에 추가해요.</List.Item>
                            <List.Item>인증 정보 입력 칸(<Code>{MCP_HEADER}</Code>)에 위 키를 붙여 넣어요.</List.Item>
                            <List.Item>카카오 툴즈나 AI 채팅에서 &quot;이번 주 내 운동 요약 알려줘&quot;라고 말해 보세요.</List.Item>
                        </List>
                        <Text size="xs" c="dimmed">
                            다른 MCP 클라이언트에서는 서버 주소 <Code>{mcpUrl}</Code>에 헤더 <Code>{MCP_HEADER}</Code>로 키를 넣으면 돼요.
                        </Text>
                        <Button onClick={closeIssue}>확인했어요</Button>
                    </Stack>
                )}
            </Modal>

            <Modal opened={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="연결 키 폐기" centered>
                <Stack>
                    <Text size="sm">
                        <Code>{revokeTarget?.key_prefix}…</Code> 키를 폐기할까요? 이 키로 연결된 AI 비서는 바로 접근할 수 없게 되고, 되돌릴 수 없어요.
                    </Text>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setRevokeTarget(null)}>취소</Button>
                        <Button color="red" onClick={handleRevoke} loading={loading}>폐기</Button>
                    </Group>
                </Stack>
            </Modal>
        </Paper>
    );
}
