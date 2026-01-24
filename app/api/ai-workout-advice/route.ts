import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { cookies } from 'next/headers';
import dayjs from 'dayjs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch user profile for overall_goal
        const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('overall_goal')
            .eq('id', user.id)
            .single();

        const overallGoal = userProfile?.overall_goal || null;

        // Fetch last 1 month workout data
        const oneMonthAgo = dayjs().subtract(1, 'month').format('YYYY-MM-DD');
        const today = dayjs().format('YYYY-MM-DD');

        const { data: workouts, error: workoutsError } = await supabase
            .from('workouts')
            .select('*')
            .eq('user_id', user.id)
            .gte('workout_date', oneMonthAgo)
            .lte('workout_date', today)
            .order('workout_date', { ascending: true });

        if (workoutsError) {
            throw workoutsError;
        }

        if (!workouts || workouts.length === 0) {
            return NextResponse.json({
                error: "최근 1개월간 운동 기록이 없습니다. 운동 기록을 먼저 입력해주세요."
            }, { status: 400 });
        }

        // Fetch personal goals
        const { data: personalGoals } = await supabase
            .from('personal_goals')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true);

        // Format workout data for AI
        const workoutSummary = workouts.map(w => ({
            type: w.workout_type,
            date: w.workout_date,
            distance_km: w.workout_type === 'swimming' ? w.distance_meters : (w.distance_meters / 1000),
            duration_minutes: Math.round(w.duration_seconds / 60),
            avg_heart_rate: w.avg_heart_rate,
            cadence: w.cadence,
            pace: w.workout_type === 'swimming'
                ? (w.duration_seconds / 60) / (w.distance_meters / 100) // min/100m
                : (w.duration_seconds / 60) / (w.distance_meters / 1000) // min/km
        }));

        // Calculate statistics
        const stats = {
            total_workouts: workouts.length,
            workout_days: new Set(workouts.map(w => w.workout_date)).size,
            by_type: workouts.reduce((acc: any, w) => {
                if (!acc[w.workout_type]) {
                    acc[w.workout_type] = { count: 0, total_distance: 0, total_duration: 0 };
                }
                acc[w.workout_type].count++;
                acc[w.workout_type].total_distance += w.distance_meters;
                acc[w.workout_type].total_duration += w.duration_seconds;
                return acc;
            }, {})
        };

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
당신은 전문 운동 코치입니다. 다음은 사용자의 최근 1개월 운동 기록입니다.

**운동 통계:**
- 총 운동 횟수: ${stats.total_workouts}회
- 운동한 일수: ${stats.workout_days}일
- 운동 종목별 요약:
${Object.entries(stats.by_type).map(([type, data]: [string, any]) => `
  * ${type}: ${data.count}회, 총 거리 ${type === 'swimming' ? data.total_distance + 'm' : (data.total_distance / 1000).toFixed(2) + 'km'}, 총 시간 ${Math.round(data.total_duration / 60)}분
`).join('')}
${overallGoal ? `
**사용자의 종합 목표:**
${overallGoal}
` : ''}

**현재 설정된 종목별 목표:**
${personalGoals && personalGoals.length > 0 ? personalGoals.map((g: any) => `
- ${g.activity_type} (${g.period_type}): ${g.target_value}${g.activity_type === 'swimming' ? 'm' : 'km'}
`).join('') : '설정된 목표 없음'}

**상세 운동 기록 (최근 순):**
${workoutSummary.slice(-20).map(w => `
- ${w.date}: ${w.type}, ${w.distance_km.toFixed(2)}${w.type === 'swimming' ? 'm' : 'km'}, ${w.duration_minutes}분, 페이스: ${w.pace.toFixed(2)}분/${w.type === 'swimming' ? '100m' : 'km'}${w.avg_heart_rate ? ', 평균심박수: ' + w.avg_heart_rate + 'bpm' : ''}
`).join('')}

다음 질문에 답변해주세요:

1. **현재 운동 패턴 분석**: 운동 빈도, 강도, 종목별 분포를 평가해주세요.
2. **개선 제안**: 운동 효과를 높이기 위해 개선할 수 있는 구체적인 방법을 제시해주세요.
3. **향후 운동 계획**: 전문가의 관점에서 다음 1개월 동안 어떻게 운동 계획을 잡으면 좋을지 조언해주세요.
4. **주의사항**: 과훈련이나 부상 위험이 있다면 경고해주세요.
5. **목표 조정 제안**: 현재 설정된 목표를 분석하여, 조정이 필요하다면 구체적인 목표값을 제안해주세요.

답변은 친근하고 격려하는 톤으로, 구체적이고 실천 가능한 조언으로 작성해주세요. 마크다운 형식으로 작성해주세요.

**중요: 목표 조정을 제안하는 경우, 답변 마지막에 다음 형식의 JSON을 포함해주세요:**
\`\`\`json
{
  "goal_recommendations": [
    {
      "activity_type": "running",
      "period_type": "weekly",
      "current_target": 20,
      "recommended_target": 25,
      "reason": "조정 이유"
    }
  ]
}
\`\`\`
`;

        const result = await model.generateContentStream(prompt);

        // Create a readable stream for the response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        controller.enqueue(encoder.encode(text));
                    }
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });

    } catch (error: any) {
        console.error("Error generating workout advice:", error);

        const status = error.status || 500;
        const message = error.message || "AI 조언 생성에 실패했습니다";

        if (message.includes("429") || message.includes("Quota") || status === 429) {
            return NextResponse.json(
                { error: "API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요." },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: message },
            { status: status }
        );
    }
}
