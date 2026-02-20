'use client';

import { useState, useEffect, useCallback } from 'react';
import { requestNotificationPermissionAndSaveToken, registerServiceWorker } from '@/lib/firebase/fcm';

export type NotificationStatus =
    | 'idle'
    | 'loading'
    | 'granted'
    | 'denied'
    | 'ios-not-installed'
    | 'unsupported';

/**
 * useFCMNotification hook
 * - 앱 시작 시 서비스 워커 등록
 * - 권한 상태 추적
 * - iOS 안내 배너 표시 여부
 */
export function useFCMNotification() {
    const [status, setStatus] = useState<NotificationStatus>('idle');
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    // 앱 최초 마운트 시 서비스 워커 등록
    useEffect(() => {
        registerServiceWorker();

        // 이미 권한이 부여된 경우 자동으로 토큰 재발급/저장 시도
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
                requestNotificationPermissionAndSaveToken().then((result) => {
                    setStatus(result as NotificationStatus);
                });
            }
        }
    }, []);

    const requestPermission = useCallback(async () => {
        setStatus('loading');
        const result = await requestNotificationPermissionAndSaveToken();
        setStatus(result as NotificationStatus);

        if (result === 'ios-not-installed') {
            setShowIOSGuide(true);
        }
    }, []);

    const dismissIOSGuide = useCallback(() => {
        setShowIOSGuide(false);
    }, []);

    return {
        status,
        showIOSGuide,
        requestPermission,
        dismissIOSGuide,
    };
}
