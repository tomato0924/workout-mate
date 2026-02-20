// Firebase Messaging Service Worker v1.0.0
// Handles background push notifications for Workout Mate PWA

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAcYoBrEmVPairEKhjQBnk0xwo6gKS4u7U",
    authDomain: "workout-mate-cb349.firebaseapp.com",
    projectId: "workout-mate-cb349",
    storageBucket: "workout-mate-cb349.firebasestorage.app",
    messagingSenderId: "526754955918",
    appId: "1:526754955918:web:3b252deea1b3bffdb87fdf",
    measurementId: "G-E6HV46H5ZL"
});

const messaging = firebase.messaging();

// 백그라운드 메시지 수신 처리
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const { notification, data } = payload;

    const notificationTitle = notification?.title || data?.title || 'Workout Mate';
    const notificationOptions = {
        body: notification?.body || data?.body || '새로운 알림이 있습니다.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: data?.workout_id ? `workout-${data.workout_id}` : 'workout-mate',
        renotify: true,
        data: {
            url: data?.url || '/dashboard',
            workout_id: data?.workout_id || null,
            type: data?.type || 'general',
        },
        actions: [
            {
                action: 'open',
                title: '확인하기',
            },
            {
                action: 'close',
                title: '닫기',
            },
        ],
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 처리 - 해당 피드 상세 페이지로 이동
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event);
    event.notification.close();

    if (event.action === 'close') return;

    const notificationData = event.notification.data;
    let targetUrl = '/dashboard';

    if (notificationData?.url) {
        targetUrl = notificationData.url;
    } else if (notificationData?.workout_id) {
        targetUrl = `/dashboard/workouts/${notificationData.workout_id}?from=feed`;
    }

    // 이미 열려 있는 탭을 찾아 포커스하거나 새 탭을 엽니다
    event.waitUntil(
        clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // 이미 앱이 열려있으면 해당 탭 포커스 후 이동
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.focus();
                        return client.navigate(targetUrl);
                    }
                }
                // 열려있는 탭이 없으면 새 탭 오픈
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
    );
});

// 서비스 워커 푸시 이벤트 (직접 Push API 사용 시 대비)
self.addEventListener('push', (event) => {
    if (event.data) {
        try {
            const payload = event.data.json();
            const title = payload.notification?.title || payload.data?.title || 'Workout Mate';
            const options = {
                body: payload.notification?.body || payload.data?.body || '새로운 알림이 있습니다.',
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: payload.data || {},
            };
            event.waitUntil(self.registration.showNotification(title, options));
        } catch (e) {
            console.error('[firebase-messaging-sw.js] Push parse error:', e);
        }
    }
});
