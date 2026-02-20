import { NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/firebase/admin';
import { createClient } from '@supabase/supabase-js';

// 이 API는 클라이언트가 아닌 DB Webhook 등에 의해 호출되므로 Service Role 키를 통해 우회 권한으로 조회합니다.
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * [POST] /api/notifications/push
 * Supabase Database Webhook으로 notifications 테이블 INSERT 감지 시 호출됩니다.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Supabase Webhook payload 구조
        // { type: 'INSERT', table: 'notifications', record: { id, user_id, actor_id, type, workout_id, content... }, ... }
        const { record, type } = body;

        if (type !== 'INSERT' || !record) {
            return NextResponse.json({ error: 'Invalid payload or not an INSERT event' }, { status: 400 });
        }

        // 1. 알림 수신자의 FCM 토큰 조회
        const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('fcm_token')
            .eq('id', record.user_id)
            .single();

        if (profileError || !userProfile?.fcm_token) {
            // 토큰이 없거나 알림 수신 거부(또는 권한 미부여) 상태
            return NextResponse.json({ success: true, message: 'No FCM token found for user' });
        }

        // 2. 알림 발생자(Actor)의 이름 조회
        const { data: actorProfile } = await supabase
            .from('user_profiles')
            .select('nickname')
            .eq('id', record.actor_id)
            .single();

        const actorName = actorProfile?.nickname || '누군가';

        // 3. 알림 내용 구성
        let title = 'Workout Mate';
        let pushBody = '새로운 알림이 있습니다.';

        if (record.type === 'reaction') {
            title = '새로운 반응 👏';
            pushBody = `${actorName}님이 회원님의 운동 기록에 반응을 남겼습니다: ${record.content}`;
        } else if (record.type === 'comment') {
            title = '새로운 댓글 💬';
            pushBody = `${actorName}님이 댓글을 남겼습니다: "${record.content}"`;
        }

        // 4. 푸시 발송
        // 클릭 시 해당 상세 페이지로 이동할 수 있도록 data 항목 포함
        await sendPushNotification(
            userProfile.fcm_token,
            title,
            pushBody,
            {
                url: `/dashboard/workouts/${record.workout_id}?from=feed`, // 클릭 시 이동 경로
                workout_id: String(record.workout_id),
                type: record.type
            }
        );

        return NextResponse.json({ success: true, message: 'Push notification queued' });
    } catch (error) {
        console.error('[Push Webhook API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
