'use client';
import { createClient } from '@/lib/supabase/client';
import type { Competition, CompetitionType, CompetitionRegistrationPeriod, CompetitionComment } from '@/types';

// Competition type labels (Korean)
export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
    marathon: '마라톤',
    triathlon: '트라이애슬론',
    granfondo: '그란폰도',
    trail_run: '트레일런',
    other: '기타',
};

// Competition type colors
export const COMPETITION_TYPE_COLORS: Record<CompetitionType, string> = {
    marathon: '#228be6',
    triathlon: '#40c057',
    granfondo: '#f59f00',
    trail_run: '#e64980',
    other: '#868e96',
};

export const ALL_COMPETITION_TYPES: CompetitionType[] = [
    'marathon', 'triathlon', 'granfondo', 'trail_run', 'other'
];

// LocalStorage key for filter
const FILTER_KEY = 'workout_mate_competition_filters';

export function loadSavedFilters(): CompetitionType[] {
    if (typeof window === 'undefined') return ALL_COMPETITION_TYPES;
    try {
        const saved = localStorage.getItem(FILTER_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch { }
    return ALL_COMPETITION_TYPES;
}

export function saveFilters(filters: CompetitionType[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
}

// Select query with registration_periods
const COMPETITION_SELECT = `
    *,
    registrant:user_profiles!competitions_registered_by_fkey(*),
    participants:competition_participants(
        *,
        user:user_profiles(*)
    ),
    registration_periods:competition_registration_periods(*)
`;

// Check if current user is admin
export async function checkIsAdmin(): Promise<boolean> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    return data?.role === 'admin';
}

// Fetch competitions for a given year/month with optional type filter
export async function fetchCompetitions(
    year: number,
    month: number,
    types?: CompetitionType[]
): Promise<Competition[]> {
    const supabase = createClient();

    // Get the first day of the month minus 7 days, and last day plus 7 days, to capture multi-day events
    const startDate = new Date(year, month - 1, 1);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(year, month, 0);
    endDate.setDate(endDate.getDate() + 7);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    let query = supabase
        .from('competitions')
        .select(COMPETITION_SELECT)
        .lte('start_date', endStr)
        .gte('end_date', startStr)
        .order('start_date', { ascending: true });

    if (types && types.length > 0 && types.length < ALL_COMPETITION_TYPES.length) {
        query = query.in('competition_type', types);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching competitions:', error);
        return [];
    }

    return data || [];
}

// Get a single competition by ID
export async function fetchCompetition(id: string): Promise<Competition | null> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('competitions')
        .select(COMPETITION_SELECT)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching competition:', error);
        return null;
    }

    return data;
}

// Create competition
export async function createCompetition(data: {
    competition_type: CompetitionType;
    name: string;
    abbreviation?: string;
    start_date: string;
    end_date: string;
    start_time?: string;
    location: string;
    homepage_url?: string;
    memo?: string;
}): Promise<{ competition?: Competition; duplicateWarning?: string; error?: string }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Check for duplicates: same name (case-insensitive) within ±7 days
    const checkStart = new Date(data.start_date);
    checkStart.setDate(checkStart.getDate() - 7);
    const checkEnd = new Date(data.start_date);
    checkEnd.setDate(checkEnd.getDate() + 7);

    const { data: existing } = await supabase
        .from('competitions')
        .select('id, name, start_date')
        .gte('start_date', checkStart.toISOString().split('T')[0])
        .lte('start_date', checkEnd.toISOString().split('T')[0])
        .ilike('name', `%${data.name}%`);

    if (existing && existing.length > 0) {
        const names = existing.map(e => `"${e.name}" (${e.start_date})`).join(', ');
        return { duplicateWarning: `유사한 대회가 이미 등록되어 있습니다: ${names}` };
    }

    const { data: created, error } = await supabase
        .from('competitions')
        .insert({
            ...data,
            registered_by: user.id,
        })
        .select(COMPETITION_SELECT)
        .single();

    if (error) {
        return { error: error.message };
    }

    return { competition: created };
}

// Force create (bypass duplicate check)
export async function forceCreateCompetition(data: {
    competition_type: CompetitionType;
    name: string;
    abbreviation?: string;
    start_date: string;
    end_date: string;
    start_time?: string;
    location: string;
    homepage_url?: string;
    memo?: string;
}): Promise<{ competition?: Competition; error?: string }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data: created, error } = await supabase
        .from('competitions')
        .insert({
            ...data,
            registered_by: user.id,
        })
        .select(COMPETITION_SELECT)
        .single();

    if (error) return { error: error.message };
    return { competition: created };
}

// Toggle participation
export async function toggleParticipation(
    competitionId: string
): Promise<{ participating: boolean; error?: string }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { participating: false, error: 'Not authenticated' };

    // Check if currently participating
    const { data: existing } = await supabase
        .from('competition_participants')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (existing) {
        // Remove participation
        const { error } = await supabase
            .from('competition_participants')
            .delete()
            .eq('id', existing.id);

        if (error) return { participating: true, error: error.message };
        return { participating: false };
    } else {
        // Add participation
        const { error } = await supabase
            .from('competition_participants')
            .insert({
                competition_id: competitionId,
                user_id: user.id,
            });

        if (error) return { participating: false, error: error.message };
        return { participating: true };
    }
}

// Delete competition
export async function deleteCompetition(id: string): Promise<{ error?: string }> {
    const supabase = createClient();
    const { error } = await supabase
        .from('competitions')
        .delete()
        .eq('id', id);

    if (error) return { error: error.message };
    return {};
}

// Update competition
export async function updateCompetition(
    id: string,
    data: Partial<{
        competition_type: CompetitionType;
        name: string;
        abbreviation: string;
        start_date: string;
        end_date: string;
        start_time: string;
        location: string;
        homepage_url: string;
        memo: string;
    }>
): Promise<{ competition?: Competition; error?: string }> {
    const supabase = createClient();

    const { data: updated, error } = await supabase
        .from('competitions')
        .update(data)
        .eq('id', id)
        .select(COMPETITION_SELECT)
        .single();

    if (error) return { error: error.message };
    return { competition: updated };
}

// =====================================================
// Registration Period CRUD
// =====================================================

export async function addRegistrationPeriod(
    competitionId: string,
    data: { category_name: string; registration_date: string; registration_time?: string }
): Promise<{ period?: CompetitionRegistrationPeriod; error?: string }> {
    const supabase = createClient();
    const { data: created, error } = await supabase
        .from('competition_registration_periods')
        .insert({
            competition_id: competitionId,
            ...data,
        })
        .select('*')
        .single();

    if (error) return { error: error.message };
    return { period: created };
}

export async function deleteRegistrationPeriod(id: string): Promise<{ error?: string }> {
    const supabase = createClient();
    const { error } = await supabase
        .from('competition_registration_periods')
        .delete()
        .eq('id', id);

    if (error) return { error: error.message };
    return {};
}

// Fetch registration periods that fall within a date range (for calendar display)
export async function fetchRegistrationPeriodsByDateRange(
    startDate: string,
    endDate: string
): Promise<(CompetitionRegistrationPeriod & { competition?: Competition })[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('competition_registration_periods')
        .select(`
            *,
            competition:competitions(*)
        `)
        .gte('registration_date', startDate)
        .lte('registration_date', endDate)
        .order('registration_date', { ascending: true });

    if (error) {
        console.error('Error fetching registration periods:', error);
        return [];
    }
    return data || [];
}

// =====================================================
// Comment CRUD
// =====================================================

const COMMENT_SELECT = `
    *,
    user:user_profiles(*),
    reactions:competition_comment_reactions(
        *,
        user:user_profiles(*)
    )
`;

export async function fetchComments(competitionId: string): Promise<CompetitionComment[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('competition_comments')
        .select(COMMENT_SELECT)
        .eq('competition_id', competitionId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
    return data || [];
}

export async function createComment(
    competitionId: string,
    content: string
): Promise<{ comment?: CompetitionComment; error?: string }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('competition_comments')
        .insert({
            competition_id: competitionId,
            user_id: user.id,
            content,
        })
        .select(COMMENT_SELECT)
        .single();

    if (error) return { error: error.message };
    return { comment: data };
}

export async function updateComment(
    commentId: string,
    content: string
): Promise<{ comment?: CompetitionComment; error?: string }> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('competition_comments')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .select(COMMENT_SELECT)
        .single();

    if (error) return { error: error.message };
    return { comment: data };
}

export async function deleteComment(commentId: string): Promise<{ error?: string }> {
    const supabase = createClient();
    const { error } = await supabase
        .from('competition_comments')
        .delete()
        .eq('id', commentId);

    if (error) return { error: error.message };
    return {};
}

// =====================================================
// Reaction Toggle
// =====================================================

export const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '🎉', '💪', '🔥'];

export async function toggleReaction(
    commentId: string,
    emoji: string
): Promise<{ toggled: boolean; error?: string }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { toggled: false, error: 'Not authenticated' };

    // Check if reaction exists
    const { data: existing } = await supabase
        .from('competition_comment_reactions')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('competition_comment_reactions')
            .delete()
            .eq('id', existing.id);
        if (error) return { toggled: true, error: error.message };
        return { toggled: false };
    } else {
        const { error } = await supabase
            .from('competition_comment_reactions')
            .insert({
                comment_id: commentId,
                user_id: user.id,
                emoji,
            });
        if (error) return { toggled: false, error: error.message };
        return { toggled: true };
    }
}
