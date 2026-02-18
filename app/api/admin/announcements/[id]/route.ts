import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PUT: Update announcement (admin)
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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
        const { title, content, is_popup, is_active } = body;

        const updateData: any = { updated_at: new Date().toISOString() };
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (is_popup !== undefined) updateData.is_popup = is_popup;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
            .from('announcements')
            .update(updateData)
            .eq('id', params.id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ announcement: data });
    } catch (error) {
        console.error('Announcement PUT error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE: Delete announcement (admin)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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

        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', params.id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Announcement DELETE error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
