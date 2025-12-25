import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        // Create authenticated client
        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const body = await request.json();

        // Basic validation to simulate frontend or catch required fields before DB
        // However, for this test (Data Integrity), we want the DB to throw the error if possible,
        // OR we validate here to return 400 as expected by the test.
        // The test expects 400 or 422.

        // Attempt insert to let DB constraints trigger
        const { data, error } = await supabase
            .from('workouts')
            .insert({
                ...body,
                user_id: user.id // Ensure user_id is set from token
            })
            .select()
            .single();

        if (error) {
            // Return 400 for DB constraint violations (validation errors)
            return NextResponse.json({ error: error.message, details: error }, { status: 400 });
        }

        return NextResponse.json(data);

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
