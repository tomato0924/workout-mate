import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient();

        // 1. Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // 2. Check admin privileges
        const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !userProfile || !['admin', 'super_admin'].includes(userProfile.role)) {
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            );
        }

        const targetUserId = params.id;
        const adminSupabase = createAdminClient();

        // 3. Delete user from auth system (cascades to user_profiles if configured, 
        // otherwise we might need to manually delete from tables too, but typically auth is the root)
        const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(
            targetUserId
        );

        if (deleteError) {
            console.error('Error deleting user:', deleteError);
            return NextResponse.json(
                { error: 'Failed to delete user' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
