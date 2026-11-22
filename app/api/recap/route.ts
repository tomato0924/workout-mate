import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPersonalRecap } from '@/lib/recap/data';
import { parseYearParam } from '@/lib/recap/compute';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const year = parseYearParam(req.nextUrl.searchParams.get('year'));
    if (year === null) return NextResponse.json({ error: '잘못된 연도입니다.' }, { status: 400 });

    try {
        const recap = await getPersonalRecap(user.id, year);
        return NextResponse.json(recap);
    } catch (error: any) {
        console.error('Year recap error:', error);
        return NextResponse.json({ error: '결산 데이터를 불러오지 못했습니다.' }, { status: 500 });
    }
}
