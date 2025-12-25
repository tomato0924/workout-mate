import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { generateInviteCode } from '@/lib/utils/helpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
    try {
        // Get the authorization header to identify the user
        // In a real app we'd use server-side auth helper, but for this test proxy:
        // We assume the test sends the token in headers.

        // NOTE: This basic proxy might fail RLS if we don't pass the session correctly.
        // For robust testing, we rely on the token passed by the test client.

        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        // Create a client with the user's token
        const token = authHeader.replace('Bearer ', '');
        const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        const body = await request.json();
        const { name, description } = body;

        // Get current user
        const { data: { user } } = await supabaseWithAuth.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { data, error } = await supabaseWithAuth
            .from('groups')
            .insert({
                name,
                description,
                owner_id: user.id,
                invite_code: generateInviteCode(),
                approval_status: 'pending' // Default to pending
            })
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
