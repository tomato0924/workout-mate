import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST: Mark announcement as read
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { error } = await supabase
            .from('announcement_reads')
            .upsert({
                announcement_id: params.id,
                user_id: user.id,
            }, {
                onConflict: 'announcement_id,user_id',
            });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Announcement read error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
