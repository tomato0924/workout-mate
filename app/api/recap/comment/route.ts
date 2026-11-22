import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { getPersonalRecap } from '@/lib/recap/data';
import { parseYearParam, TYPE_LABELS, formatKm, formatHours, WEEKDAY_LABELS, withHonorific } from '@/lib/recap/compute';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 연말 결산 마지막 장에 들어갈 AI 한 해 한 줄 평 + 내년 응원
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const year = parseYearParam(req.nextUrl.searchParams.get('year'));
    if (year === null) return NextResponse.json({ error: '잘못된 연도입니다.' }, { status: 400 });

    try {
        const r = await getPersonalRecap(user.id, year);
        if (r.totalCount === 0) {
            return NextResponse.json({
                title: `${year + 1}년은 함께 달려요`,
                message: `올해는 기록이 없었지만 괜찮아요. ${year + 1}년의 첫 운동을 크루와 함께 시작해 봐요! 💪`,
            });
        }

        const types = Object.entries(r.byType)
            .map(([t, s]) => `${TYPE_LABELS[t as keyof typeof TYPE_LABELS]} ${s!.count}회`)
            .join(', ');

        const prompt = `
# Role: 따뜻하고 센스 있는 운동 메이트 AI 코치

# Task:
사용자 "${withHonorific(r.nickname)}"의 ${year}년 운동 결산 데이터를 보고, 연말 결산 리포트 마지막 장에 들어갈 문구를 한국어로 작성하세요.

# Data:
- 총 운동 ${r.totalCount}회, 운동한 날 ${r.activeDays}일, 최장 연속 ${r.longestStreak}일
- 총 운동 시간 ${formatHours(r.totalDuration)}, 수영 제외 총 거리 ${formatKm(r.totalDistance)}km
- 종목: ${types}
- 가장 열심히 한 달: ${r.busiestMonth ? `${r.busiestMonth.month}월(${r.busiestMonth.count}회)` : '없음'}
- 가장 자주 운동한 요일: ${r.favoriteWeekday ? `${WEEKDAY_LABELS[r.favoriteWeekday.weekday]}요일` : '없음'}
- 참가 대회: ${r.competitions.length > 0 ? r.competitions.map(c => c.name).join(', ') : '없음'}
- 친구들에게 받은 응원 ${r.reactionsReceived + r.commentsReceived}개, 내가 남긴 응원 ${r.cheersGiven}개

# Constraints:
1. title: 이 사람의 한 해를 표현하는 별명 같은 칭호, 15자 이내 (예: "꾸준함의 아이콘", "주말 장거리 마스터")
2. message: 한 해를 칭찬하고 ${year + 1}년을 응원하는 2~3문장, 120자 이내, 이모지 1~2개
3. 데이터에 있는 구체적인 숫자나 사실을 최소 1개 언급
4. 과장된 의학적 조언 금지

# Output JSON Format:
{ "title": "...", "message": "..." }
`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
        if (!match) throw new Error('JSON parsing failed');
        const parsed = JSON.parse(match[1] || match[0]);

        return NextResponse.json({ title: String(parsed.title ?? ''), message: String(parsed.message ?? '') });
    } catch (error: any) {
        console.error('Year recap comment error:', error);
        return NextResponse.json({ error: 'AI 코멘트를 만들지 못했습니다.' }, { status: 500 });
    }
}
