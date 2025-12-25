export type UserRole = 'super_admin' | 'admin' | 'user';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type WorkoutType = 'running' | 'swimming' | 'cycling' | 'treadmill' | 'hiking';
export type SharingType = 'public' | 'private' | 'group';

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    nickname: string;
    phone: string;
    role: UserRole;
    approval_status: ApprovalStatus;
    created_at: string;
}

export interface Group {
    id: string;
    name: string;
    description: string;
    invite_code: string;
    owner_id: string;
    approval_status: ApprovalStatus;
    created_at: string;
    owner?: UserProfile;
}

export interface GroupMember {
    id: string;
    group_id: string;
    user_id: string;
    joined_at: string;
    user?: UserProfile;
}

export interface Workout {
    id: string;
    user_id: string;
    workout_type: WorkoutType;
    workout_date: string;
    duration_seconds: number;
    distance_meters: number;
    avg_heart_rate?: number;
    cadence?: number; // for running/treadmill
    swolf?: number; // for swimming
    sharing_type: SharingType;
    shared_group_id?: string;
    created_at: string;
    user?: UserProfile;
    images?: WorkoutImage[];
    reactions?: WorkoutReaction[];
    comments?: WorkoutComment[];
}

export interface WorkoutImage {
    id: string;
    workout_id: string;
    image_url: string;
    created_at: string;
}

export interface GroupPost {
    id: string;
    group_id: string;
    user_id: string;
    title: string;
    content: string;
    created_at: string;
    user?: UserProfile;
    comments?: PostComment[];
}

export interface WorkoutReaction {
    id: string;
    workout_id: string;
    user_id: string;
    emoji: string;
    created_at: string;
    user?: UserProfile;
}

export interface WorkoutComment {
    id: string;
    workout_id: string;
    user_id: string;
    content: string;
    created_at: string;
    user?: UserProfile;
}

export interface PostComment {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    created_at: string;
    user?: UserProfile;
}

export interface LeaderboardEntry {
    user_id: string;
    user?: UserProfile;
    total_distance: number;
    total_duration: number;
    workout_count: number;
    rank?: number;
}
