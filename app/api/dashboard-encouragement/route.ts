import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import dayjs from 'dayjs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const todayStr = dayjs().format('YYYY-MM-DD');
        const thirtyDaysLater = dayjs().add(30, 'day').format('YYYY-MM-DD');

        // 1. Fetch Upcoming Competitions
        const { data: upcomingCompetitions } = await supabase
            .from('competitions')
            .select('name, start_date')
            .lte('start_date', thirtyDaysLater)
            .gte('end_date', todayStr)
            .order('start_date', { ascending: true });

        // 2. Fetch Latest AI Coaching
        const { data: coaching } = await supabase
            .from('ai_coaching_history')
            .select('coaching_content')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // 3. Fetch Crew Activity
        let crewActivitySummary = '크루 활동 내역 없음';
        const { data: myGroups } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', user.id);

        if (myGroups && myGroups.length > 0) {
            const groupIds = myGroups.map(g => g.group_id);
            const { data: crewMembers } = await supabase
                .from('group_members')
                .select('user_id')
                .in('group_id', groupIds);
            
            if (crewMembers && crewMembers.length > 0) {
                const memberIds = [...new Set(crewMembers.map(m => m.user_id).filter(id => id !== user.id))];
                if (memberIds.length > 0) {
                    const { data: recentCrewWorkouts } = await supabase
                        .from('workouts')
                        .select('workout_type, distance_meters, user_profiles!inner(nickname)')
                        .in('user_id', memberIds)
                        .in('sharing_type', ['public', 'group'])
                        .order('created_at', { ascending: false })
                        .limit(5);

                    if (recentCrewWorkouts && recentCrewWorkouts.length > 0) {
                        crewActivitySummary = recentCrewWorkouts.map((w: any) => 
                            `${w.user_profiles.nickname}님이 ${w.workout_type} ${(w.distance_meters/1000).toFixed(1)}km 진행함`
                        ).join(', ');
                    }
                }
            }
        }

        // 4. Fetch User's Recent 30-day abstract
        const thirtyDaysAgoStr = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
        const { data: workouts } = await supabase
            .from('workouts')
            .select('*')
            .eq('user_id', user.id)
            .gte('workout_date', thirtyDaysAgoStr)
            .order('workout_date', { ascending: true });

        const totalWorkouts = workouts ? workouts.length : 0;
        const types = workouts ? [...new Set(workouts.map(w => w.workout_type))].join(', ') : '없음';

        const prompt = `
# Role: 열정적이고 센스 있는 AI 피트니스 코치

# Context:
당신은 메인 대시보드에서 사용자를 매일 독려하는 4개의 요약 카드(활동량, 포트폴리오, 베스트 기록, 목표 달성)에 들어갈 **가장 개인화된 자연스러운 코멘트**를 생성합니다. 
사용자의 개인 데이터(대회, 최근 코칭, 크루원 활동)를 적극적으로 언급하며 동기를 부여하세요.

# Data:
- [사용자 30일 운동 요약]: 총 ${totalWorkouts}회 운동. 종목: ${types}
- [다가오는 대회]: ${upcomingCompetitions && upcomingCompetitions.length > 0 ? upcomingCompetitions.map(c => `${c.name}(${c.start_date})`).join(', ') : '해당 없음'}
- [최근 AI 코칭 핵심 내용]: ${coaching ? coaching.coaching_content.substring(0, 150) + '...' : '해당 없음'}
- [크루원 최근 활동]: ${crewActivitySummary}

# Constraints:
1. 각 카드별로 정확히 **15~35자 사이의 짧고 임팩트 있는 평문이나 구어체 한 문장**만 생성하세요. (이모지 1개 포함 권장)
2. 다가오는 대회가 있다면 최소 1개의 카드에서 꼭 언급하세요.
3. 크루의 활동이 있다면 "OO님이 달리셨네요!"와 같이 함께한다는 느낌을 1개의 카드에서 꼭 주세요.
4. AI 코칭 이력이 있다면 그 조언을 가볍게 상기시키는 말을 꼭 넣으세요.

# Output JSON Format:
{
  "activity_message": "최근 30일 활동량 카드에 들어갈 멘트",
  "portfolio_message": "운동 포트폴리오(종목) 카드에 들어갈 멘트",
  "best_workout_message": "베스트 기록 카드에 들어갈 멘트",
  "goal_achievement_message": "목표 달성 카드에 들어갈 멘트"
}
`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Extract JSON
        const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*?}/);
        if (!match) throw new Error("JSON parsing failed");
        const parsed = JSON.parse(match[1] || match[0]);

        return NextResponse.json(parsed);
    } catch (error: any) {
        console.error("AI Encouragement generation error:", error);
        return NextResponse.json(
            { error: error.message || "독려 메시지 생성 실패" },
            { status: 500 }
        );
    }
}
