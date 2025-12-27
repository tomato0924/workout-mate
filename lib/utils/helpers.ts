import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('ko');

export function formatDate(date: string): string {
    return dayjs(date).format('YYYY년 MM월 DD일');
}

export function formatCompactDate(date: string): string {
    return `'${dayjs(date).format('YY/MM/DD')}`;
}

export function formatDateTime(date: string): string {
    return dayjs(date).format('YYYY년 MM월 DD일 HH:mm');
}

export function formatRelativeTime(date: string): string {
    return dayjs(date).fromNow();
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) {
        return `${minutes}분`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

export function formatDistance(km: number): string {
    if (km < 1) {
        return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(2)}km`;
}

export function formatSpeed(kmh: number): string {
    return `${kmh.toFixed(2)}km/h`;
}

export function formatPace(kmh: number): string {
    // Convert km/h to min/km
    const minPerKm = 60 / kmh;
    const mins = Math.floor(minPerKm);
    const secs = Math.round((minPerKm - mins) * 60);
    return `${mins}'${secs.toString().padStart(2, '0')}"`;
}

export function generateInviteCode(length: number = 8): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export function calculateCalories(
    workoutType: string,
    durationMinutes: number,
    distanceKm: number
): number {
    // Simple calorie estimation (can be refined)
    const caloriesPerKm: { [key: string]: number } = {
        running: 60,
        swimming: 200,
        cycling: 30,
        treadmill: 60,
        hiking: 50,
    };

    const rate = caloriesPerKm[workoutType] || 50;
    return Math.round(distanceKm * rate);
}
