import * as admin from 'firebase-admin';

// 중복 초기화 방지
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID || 'workout-mate-cb349',
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // 환경변수에서 줄바꿈 문자(\n)가 제대로 인식되지 않는 경우를 위해 처리
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
        console.log('[Firebase Admin] Initialized.');
    } catch (error) {
        console.error('[Firebase Admin] Initialization error', error);
    }
}

export const adminMessaging = admin.messaging();

/**
 * FCM 푸시 알림 발송 유틸십니다.
 * @param token 수신자 단말기의 FCM 토큰
 * @param title 알림 제목
 * @param body 알림 본문
 * @param data 추가 데이터 (클릭 시 이동할 url 등)
 */
export async function sendPushNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>
) {
    try {
        const payload = {
            token,
            notification: {
                title,
                body,
            },
            data: data || {},
            // 안드로이드 OS용 설정 (우선순위를 높여 안정적인 수신 유도)
            android: {
                priority: 'high' as const,
                notification: {
                    sound: 'default',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK', // PWA 외의 네이티브 래퍼 대비용
                },
            },
            // iOS OS용 설정
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        contentAvailable: true,
                    },
                },
            },
        };

        const response = await adminMessaging.send(payload);
        console.log(`[FCM] Push sent successfully to ${token.substring(0, 10)}... | Response: ${response}`);
        return true;
    } catch (error) {
        console.error('[FCM] Push send error:', error);
        return false;
    }
}
