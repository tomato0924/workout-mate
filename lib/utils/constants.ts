import { WorkoutType, UserRole, ApprovalStatus, SharingType } from '@/types';

export const WORKOUT_TYPES: { value: WorkoutType; label: string }[] = [
    { value: 'running', label: '러닝' },
    { value: 'swimming', label: '수영' },
    { value: 'cycling', label: '사이클' },
    { value: 'treadmill', label: '트레드밀' },
    { value: 'hiking', label: '등산' },
];

export const USER_ROLES: { value: UserRole; label: string }[] = [
    { value: 'super_admin', label: '슈퍼 관리자' },
    { value: 'admin', label: '관리자' },
    { value: 'user', label: '사용자' },
];

export const APPROVAL_STATUSES: { value: ApprovalStatus; label: string }[] = [
    { value: 'pending', label: '승인 대기' },
    { value: 'approved', label: '승인됨' },
    { value: 'rejected', label: '거절됨' },
];

export const SHARING_TYPES: { value: SharingType; label: string }[] = [
    { value: 'public', label: '전체 공개' },
    { value: 'private', label: '나만 보기' },
    { value: 'group', label: '특정 그룹' },
];

export const REACTION_EMOJIS = ['👍', '💪', '🔥', '🎉', '❤️', '👏', '⭐', '🏆'];

export const MAX_WORKOUT_IMAGES = 3;
