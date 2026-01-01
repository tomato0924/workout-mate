import { createClient } from '@supabase/supabase-js';

// Note: This client should ONLY be used in server-side contexts (API routes, Server Actions)
// NEVER use this in client-side components as it exposes the service role key.
export const createAdminClient = () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables');
    }

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
};
