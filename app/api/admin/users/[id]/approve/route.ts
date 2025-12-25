import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// For admin actions, we often need the SERVICE ROLE key to bypass RLS "can only update self" if poorly configured,
// BUT proper RLS should allow "admin role users" to update "approval_status".
// We will try with the user's token first (Mocking client-side admin action).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        // Check if requester is admin (Optional here, RLS will enforce it in DB)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const userId = params.id;
        const body = await request.json();
        const { action } = body; // 'approve' or 'reject'

        const status = action === 'approve' ? 'approved' : 'rejected';

        const { data, error } = await supabase
            .from('user_profiles')
            .update({ approval_status: status })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
