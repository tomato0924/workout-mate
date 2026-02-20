'use client';

import { useEffect, useState } from 'react';
import { Modal, Text, Button, Group, Stack, Dialog, ActionIcon } from '@mantine/core';
import { IconBellRinging, IconX } from '@tabler/icons-react';
import { useFCMNotification } from '@/lib/hooks/useFCMNotification';

export function FCMManager() {
    const { status, showIOSGuide, requestPermission, dismissIOSGuide } = useFCMNotification();
    const [showPrompt, setShowPrompt] = useState(false);

    // 알림 권한이 명시적으로 승인되지 않고, 거절되지 않았으며, 지원 기기라면 권한 요청 유도 배너를 띄움
    useEffect(() => {
        // idle 상태이고 현재 알림이 허용(granted)되지 않았으며 거절(denied)도 아니라면 프롬프트 표시
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                // 즉시 띄우기보다는 유저가 화면을 좀 본 후에 띄우기 (예: 2초 뒤)
                const timer = setTimeout(() => setShowPrompt(true), 2000);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const handleAllowClick = async () => {
        setShowPrompt(false);
        await requestPermission();
    };

    return (
        <>
            {/* 1. Android / PC 등에서의 권한 요청 유도 다이얼로그 */}
            <Dialog
                opened={showPrompt && !showIOSGuide}
                withCloseButton
                onClose={() => setShowPrompt(false)}
                size="lg"
                radius="md"
                position={{ bottom: 20, right: 20 }}
            >
                <Group align="flex-start">
                    <IconBellRinging size={24} color="#228be6" />
                    <div style={{ flex: 1 }}>
                        <Text size="sm" fw={600} mb="xs">
                            새로운 반응이나 댓글 알림을 받아보시겠어요?
                        </Text>
                        <Text size="xs" c="dimmed" mb="md">
                            운동 기록에 친구들이 반응을 남기면 즉시 알려드립니다.
                        </Text>
                        <Group justify="flex-end">
                            <Button variant="subtle" size="xs" onClick={() => setShowPrompt(false)}>
                                나중에
                            </Button>
                            <Button size="xs" onClick={handleAllowClick} loading={status === 'loading'}>
                                알림 켜기
                            </Button>
                        </Group>
                    </div>
                </Group>
            </Dialog>

            {/* 2. iOS 전용: 홈 화면 추가 안내 모달 */}
            <Modal
                opened={showIOSGuide}
                onClose={dismissIOSGuide}
                title="iOS 기기 알림 설정 안내"
                centered
                radius="lg"
            >
                <Stack gap="md">
                    <Text size="sm">
                        iOS 환경(아이폰, 아이패드)에서는 <b>홈 화면에 앱을 추가</b>해야만 푸시 알림을 받을 수 있습니다.
                    </Text>
                    <Text size="sm" mt="xs">
                        <b>설치 방법:</b><br />
                        1. Safari 브라우저 하단의 <b>[공유]</b> 버튼(사각형과 위쪽 화살표)을 누릅니다.<br />
                        2. 메뉴를 위로 쓸어올려 <b>[홈 화면에 추가]</b>를 선택합니다.<br />
                        3. 우측 상단의 <b>[추가]</b>를 누릅니다.<br />
                        4. 홈 화면에 생성된 <b>'운동 메이트' 앱을 실행</b>하여 알림을 허용해주세요!
                    </Text>

                    <Button fullWidth mt="md" onClick={dismissIOSGuide}>
                        확인했습니다
                    </Button>
                </Stack>
            </Modal>
        </>
    );
}
