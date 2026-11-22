import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCrewAwards, NotCrewMemberError } from '@/lib/recap/data';
import { parseYearParam } from '@/lib/recap/compute';

export const dynamic = 'force-dynamic';

// 크루 연말 시상식: 크루 멤버만 조회 가능
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const year = parseYearParam(req.nextUrl.searchParams.get('year'));
    if (year === null) return NextResponse.json({ error: '잘못된 연도입니다.' }, { status: 400 });

    try {
        const awards = await getCrewAwards(user.id, params.id, year);
        return NextResponse.json(awards);
    } catch (error: any) {
        if (error instanceof NotCrewMemberError) {
            return NextResponse.json({ error: '크루 멤버만 볼 수 있어요.' }, { status: 403 });
        }
        console.error('Crew awards error:', error);
        return NextResponse.json({ error: '시상식 데이터를 불러오지 못했습니다.' }, { status: 500 });
    }
}
