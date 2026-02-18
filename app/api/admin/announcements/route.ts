import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET: List all announcements (admin) or active popup announcements (user)
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const mode = request.nextUrl.searchParams.get('mode');

        if (mode === 'admin') {
            // Admin: return all announcements
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const { data, error } = await supabase
                .from('announcements')
                .select('*, author:user_profiles!created_by(id, nickname, avatar_url)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ announcements: data });
        } else {
            // User: return active popup announcements not yet read
            const { data: announcements, error } = await supabase
                .from('announcements')
                .select('*')
                .eq('is_active', true)
                .eq('is_popup', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter out already-read announcements
            const { data: reads } = await supabase
                .from('announcement_reads')
                .select('announcement_id')
                .eq('user_id', user.id);

            const readIds = new Set((reads || []).map(r => r.announcement_id));
            const unread = (announcements || []).filter(a => !readIds.has(a.id));

            return NextResponse.json({ announcements: unread });
        }
    } catch (error) {
        console.error('Announcements GET error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Create new announcement (admin only)
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { title, content, is_popup } = body;

        if (!title || !content) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('announcements')
            .insert({
                title,
                content,
                is_popup: is_popup ?? false,
                is_active: true,
                created_by: user.id,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ announcement: data });
    } catch (error) {
        console.error('Announcements POST error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
