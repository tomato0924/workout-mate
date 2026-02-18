export type UserRole = 'super_admin' | 'admin' | 'user';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type WorkoutType = 'running' | 'swimming' | 'cycling' | 'hiking';
export type SharingType = 'public' | 'private' | 'group';
export type CompetitionType = 'marathon' | 'triathlon' | 'granfondo' | 'trail_run' | 'other';

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    nickname: string;
    phone: string;
    role: UserRole;
    approval_status: ApprovalStatus;
    avatar_url?: string | null;
    overall_goal?: string | null;
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
    active_activity_types?: ('running' | 'swimming' | 'cycling')[];
    owner?: UserProfile;
    goals?: GroupGoal[];
}

export interface GroupGoal {
    id: string;
    group_id: string;
    activity_type: 'running' | 'swimming' | 'cycling';
    period_type: 'weekly' | 'monthly';
    target_distance: number;
    created_at: string;
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
    cadence?: number; // for running/treadmill/cycling (rpm for cycling, spm for running)
    swolf?: number; // for swimming
    avg_power?: number; // for cycling (watts)
    sharing_type: SharingType;
    shared_group_id?: string;
    created_at: string;
    user?: UserProfile;
    images?: WorkoutImage[];
    reactions?: WorkoutReaction[];
    comments?: WorkoutComment[];
    view_count?: number;
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

export interface Notification {
    id: string;
    created_at: string;
    user_id: string;
    actor_id: string;
    type: 'comment' | 'reaction' | 'new_competition' | 'new_announcement';
    workout_id?: string | null;
    competition_id?: string | null;
    announcement_id?: string | null;
    content?: string;
    is_read: boolean;
    actor?: UserProfile;
}

export interface PersonalGoal {
    id: string;
    user_id: string;
    activity_type: 'running' | 'swimming' | 'cycling' | 'treadmill' | 'hiking';
    period_type: 'weekly' | 'monthly' | 'yearly';
    target_value: number;
    metric_type: 'distance' | 'time';
    is_active: boolean;
    created_at: string;
}

export interface GoalRecommendation {
    activity_type: string;
    period_type: string;
    current_target: number;
    recommended_target: number;
    reason: string;
}

export interface AiCoachingHistory {
    id: string;
    user_id: string;
    coaching_content: string;
    goal_recommendations: GoalRecommendation[] | null;
    created_at: string;
}

export interface Competition {
    id: string;
    competition_type: CompetitionType;
    name: string;
    abbreviation?: string | null;
    start_date: string;
    end_date: string;
    start_time?: string | null;
    location: string;
    homepage_url?: string | null;
    memo?: string | null;
    registered_by: string;
    created_at: string;
    registrant?: UserProfile;
    participants?: CompetitionParticipant[];
    registration_periods?: CompetitionRegistrationPeriod[];
}

export interface CompetitionParticipant {
    id: string;
    competition_id: string;
    user_id: string;
    created_at: string;
    user?: UserProfile;
}

export interface CompetitionRegistrationPeriod {
    id: string;
    competition_id: string;
    category_name: string;
    registration_date: string;
    registration_time?: string | null;
    created_at: string;
}

export interface CompetitionComment {
    id: string;
    competition_id: string;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    user?: UserProfile;
    reactions?: CompetitionCommentReaction[];
}

export interface CompetitionCommentReaction {
    id: string;
    comment_id: string;
    user_id: string;
    emoji: string;
    created_at: string;
    user?: UserProfile;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    is_popup: boolean;
    is_active: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
    author?: UserProfile;
}

