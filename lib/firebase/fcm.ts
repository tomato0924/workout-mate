'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// FCM 초기화가 완료되었는지 추적 (중복 초기화 방지)
let messagingInitialized = false;

/**
 * FCM 토큰을 서버(Supabase user_profiles)에 저장
 */
async function saveTokenToServer(token: string): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('user_profiles')
        .update({ fcm_token: token })
        .eq('id', user.id);

    if (error) {
        console.error('[FCM] Failed to save token to server:', error);
    } else {
        console.log('[FCM] Token saved to server successfully.');
    }
}

/**
 * iOS 기기 여부 판별
 */
function isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * PWA standalone 모드(홈화면 설치 후 실행) 여부 판별
 */
function isInStandaloneMode(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
        window.matchMedia('(display-mode: standalone)').matches
    );
}

/**
 * 알림 권한 요청 + FCM 토큰 획득 & 저장
 * @returns 'granted' | 'denied' | 'ios-not-installed' | 'unsupported'
 */
export async function requestNotificationPermissionAndSaveToken(): Promise<
    'granted' | 'denied' | 'ios-not-installed' | 'unsupported'
> {
    // iOS 대응: 홈화면 미설치 상태이면 안내 반환
    if (isIOS() && !isInStandaloneMode()) {
        console.log('[FCM] iOS device detected but not in standalone mode.');
        return 'ios-not-installed';
    }

    // 브라우저 지원 여부 확인
    if (typeof window === 'undefined' || !('Notification' in window)) {
        console.warn('[FCM] Notifications are not supported in this browser.');
        return 'unsupported';
    }

    try {
        // 동적 import (서버 사이드 렌더링 방지)
        const { initializeApp, getApps } = await import('firebase/app');
        const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

        const firebaseConfig = {
            apiKey: "AIzaSyAcYoBrEmVPairEKhjQBnk0xwo6gKS4u7U",
            authDomain: "workout-mate-cb349.firebaseapp.com",
            projectId: "workout-mate-cb349",
            storageBucket: "workout-mate-cb349.firebasestorage.app",
            messagingSenderId: "526754955918",
            appId: "1:526754955918:web:3b252deea1b3bffdb87fdf",
            measurementId: "G-E6HV46H5ZL"
        };

        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const messaging = getMessaging(app);

        // 권한 요청
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('[FCM] Notification permission denied.');
            return 'denied';
        }

        // FCM 토큰 발급
        const VAPID_KEY = 'BGAXbzNoJL8ssp85lHvm4E0jRV94zWkw4gy8z_QRRcDkKwu9W_YM_Hj-zqjPDVrjKWqGzU5gPVepuixO-DgQ5ik';
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js'),
        });

        if (token) {
            console.log('[FCM] Token obtained:', token);
            await saveTokenToServer(token);
        }

        // 포그라운드 메시지 수신 설정 (앱이 열려 있을 때)
        if (!messagingInitialized) {
            messagingInitialized = true;
            onMessage(messaging, (payload) => {
                console.log('[FCM] Foreground message received:', payload);
                // 포그라운드에서는 In-app Notification Bell이 있으므로 별도 처리 불필요
                // 필요하면 여기서 Mantine notifications.show() 호출 가능
            });
        }

        return 'granted';
    } catch (error) {
        console.error('[FCM] Error initializing FCM:', error);
        return 'unsupported';
    }
}

/**
 * 서비스 워커 등록 (앱 시작 시 한 번 호출)
 */
export async function registerServiceWorker(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/',
        });
        console.log('[SW] Service Worker registered:', registration.scope);
    } catch (error) {
        console.error('[SW] Service Worker registration failed:', error);
    }
}
