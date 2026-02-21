'use client';

import { useEffect, useState } from 'react';
import { Affix, Button, Transition, Text, Group, Drawer, rem, ActionIcon, Stack, ThemeIcon, Box, Center } from '@mantine/core';
import { IconDeviceMobile, IconDownload, IconX, IconShare, IconSquarePlus, IconDotsVertical, IconAppWindow } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import classes from './InstallPrompt.module.css';

export function InstallPrompt() {
    const [isMounted, setIsMounted] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [os, setOs] = useState<'ios' | 'android' | 'other'>('other');
    const [opened, { open, close }] = useDisclosure(false);

    useEffect(() => {
        setIsMounted(true);

        // Browser & PWA Environment Check
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        const isDismissed = localStorage.getItem('pwa-install-dismissed') === 'true';

        // Detect OS
        const userAgent = window.navigator.userAgent.toLowerCase();
        let currentOs: 'ios' | 'android' | 'other' = 'other';
        if (/iphone|ipad|ipod/.test(userAgent)) {
            currentOs = 'ios';
            setOs('ios');
        } else if (/android/.test(userAgent)) {
            currentOs = 'android';
            setOs('android');
        }

        // Only show if not installed, not dismissed, and on a supported mobile OS
        // You can remove `&& currentOs !== 'other'` if you want to support desktop prompt too
        if (!isStandalone && !isDismissed && currentOs !== 'other') {
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 3000); // Wait 3 seconds before showing, less aggressive
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening modal
        localStorage.setItem('pwa-install-dismissed', 'true');
        setShowPrompt(false);
    };

    if (!isMounted) return null;

    return (
        <>
            <Affix position={{ bottom: 24, left: '50%' }} zIndex={200} style={{ transform: 'translateX(-50%)', width: '90%', maxWidth: 400 }}>
                <Transition transition="slide-up" mounted={showPrompt}>
                    {(transitionStyles) => (
                        <Box style={transitionStyles} className={classes.bounce}>
                            <Group
                                wrap="nowrap"
                                p="md"
                                bg="linear-gradient(135deg, #1c7ed6 0%, #228be6 100%)" // Beautiful gradient
                                c="white"
                                className={classes.promptBar}
                                style={{ borderRadius: rem(20), cursor: 'pointer', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}
                                onClick={open}
                            >
                                <Center style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}>
                                    <IconDeviceMobile size={28} className={classes.pulseIcon} />
                                </Center>
                                <Stack gap={4} style={{ flex: 1 }}>
                                    <Text size="sm" fw={800} lh={1.1}>앱으로 설치하면 더 편해요!</Text>
                                    <Text size="xs" opacity={0.9}>터치하여 10초 만에 설치하기 ✨</Text>
                                </Stack>
                                <ActionIcon variant="transparent" c="white" size="lg" onClick={handleDismiss} style={{ opacity: 0.8, '&:hover': { opacity: 1, background: 'rgba(0,0,0,0.1)' } }}>
                                    <IconX size={20} />
                                </ActionIcon>
                            </Group>
                        </Box>
                    )}
                </Transition>
            </Affix>

            <Drawer
                opened={opened}
                onClose={close}
                position="bottom"
                title={
                    <Group gap="sm">
                        <IconAppWindow color="#228be6" />
                        <Text fw={800} size="lg" c="blue.7">앱 아이콘으로 바로가기</Text>
                    </Group>
                }
                size="auto"
                padding="xl"
                styles={{ content: { borderTopLeftRadius: 24, borderTopRightRadius: 24 } }}
            >
                <Stack gap="xl" pb="xl" pt="sm">
                    <Text size="sm" c="dimmed" lh={1.6}>
                        홈 화면에 워크아웃 메이트 앱을 추가하면, <b>앱처럼 빠르고 편리하게</b> 이용할 수 있습니다.
                    </Text>

                    <Center p="md" bg="gray.0" style={{ borderRadius: 12 }}>
                        <Stack gap="md" w="100%">
                            {os === 'ios' ? (
                                <>
                                    <Group wrap="nowrap">
                                        <ThemeIcon size="lg" radius="xl" variant="filled" color="blue">1</ThemeIcon>
                                        <Text size="sm" style={{ flex: 1 }}>화면 하단의 <IconShare size={18} color="#228be6" style={{ verticalAlign: 'middle', margin: '0 4px', display: 'inline-block' }} /> <b>공유 버튼</b>을 누릅니다.</Text>
                                    </Group>
                                    <Group wrap="nowrap">
                                        <ThemeIcon size="lg" radius="xl" variant="filled" color="blue">2</ThemeIcon>
                                        <Text size="sm" style={{ flex: 1 }}>메뉴를 위로 올려 <IconSquarePlus size={18} color="#228be6" style={{ verticalAlign: 'middle', margin: '0 4px', display: 'inline-block' }} /> <b>홈 화면에 추가</b>를 누릅니다.</Text>
                                    </Group>
                                    <Group wrap="nowrap">
                                        <ThemeIcon size="lg" radius="xl" variant="filled" color="blue">3</ThemeIcon>
                                        <Text size="sm" style={{ flex: 1 }}>우측 상단의 <b>추가</b>를 누르면 설치 완료!</Text>
                                    </Group>
                                </>
                            ) : (
                                <>
                                    <Group wrap="nowrap">
                                        <ThemeIcon size="lg" radius="xl" variant="filled" color="blue">1</ThemeIcon>
                                        <Text size="sm" style={{ flex: 1 }}>브라우저 우측 상단의 <IconDotsVertical size={18} color="#228be6" style={{ verticalAlign: 'middle', margin: '0 4px', display: 'inline-block' }} /> <b>메뉴 버튼</b>을 누릅니다.</Text>
                                    </Group>
                                    <Group wrap="nowrap">
                                        <ThemeIcon size="lg" radius="xl" variant="filled" color="blue">2</ThemeIcon>
                                        <Text size="sm" style={{ flex: 1 }}>메뉴에서 <IconDownload size={18} color="#228be6" style={{ verticalAlign: 'middle', margin: '0 4px', display: 'inline-block' }} /> <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누릅니다.</Text>
                                    </Group>
                                    <Group wrap="nowrap">
                                        <ThemeIcon size="lg" radius="xl" variant="filled" color="blue">3</ThemeIcon>
                                        <Text size="sm" style={{ flex: 1 }}>팝업 창에서 <b>설치</b>를 누르면 설치 완료!</Text>
                                    </Group>
                                </>
                            )}
                        </Stack>
                    </Center>

                    <Button mt="md" fullWidth size="lg" radius="xl" onClick={close} style={{ boxShadow: '0 4px 14px 0 rgba(34, 139, 230, 0.4)' }}>
                        확인했습니다
                    </Button>
                </Stack>
            </Drawer>
        </>
    );
}
