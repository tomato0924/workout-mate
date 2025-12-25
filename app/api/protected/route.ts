import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Explicitly check profile status to enforce logic if RLS doesn't block "reading" profile itself
        // Ideally RLS should block reading other stuff, but for this endpoint we simulate a "dashboard data fetch"

        // Check RLS enforcement: Try to read a "workout" or just check profile approval
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('approval_status')
            .eq('id', user.id)
            .single();

        if (profileError) {
            return NextResponse.json({ error: 'Profile access denied or not found' }, { status: 403 });
        }

        if (profile?.approval_status !== 'approved') {
            return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
        }

        return NextResponse.json({ message: 'Access granted to dashboard data' });

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
