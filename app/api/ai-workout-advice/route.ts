import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { cookies } from 'next/headers';
import dayjs from 'dayjs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// GET: Fetch the latest AI coaching history
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch the latest coaching history
        const { data: coaching, error } = await supabase
            .from('ai_coaching_history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }

        return NextResponse.json({
            coaching: coaching || null
        });

    } catch (error: any) {
        console.error("Error fetching coaching history:", error);
        return NextResponse.json(
            { error: error.message || "코칭 히스토리를 불러오는데 실패했습니다" },
            { status: 500 }
        );
    }
}

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
# Role: 전문적인 AI 페이스메이커 (Fitness Coach)

# Context:
이 앱은 다양한 운동 목표를 가진 유저들이 사용한다. 
AI는 각 유저가 설정한 {종합 목표}와 {최근 운동 데이터}를 비교 분석하여 최적의 코칭을 제공해야 한다.

# Task: 
사용자의 운동 기록과 개인별 {종합 목표}를 바탕으로, 핵심적인 피드백과 단계적 계획을 제공한다.

# Constraints:
1. **목표 가변성:** '4월 하프마라톤' 같은 특정 목표를 전제하지 마라. 반드시 해당 유저가 입력한 {종합 목표}를 기준으로 판단하라.
2. **간결성:** 불필요한 서술어 없이 불렛 포인트 위주로 작성한다.
3. **데이터 기반:** 사용자의 최근 운동 종류, 빈도, 강도(페이스, 심박수 등)를 기반으로 분석한다.

---

**{종합 목표}:**
${overallGoal || '설정된 종합 목표 없음'}

**{최근 운동 데이터} - 1개월간 통계:**
- 총 운동 횟수: ${stats.total_workouts}회
- 운동한 일수: ${stats.workout_days}일
- 운동 종목별 요약:
${Object.entries(stats.by_type).map(([type, data]: [string, any]) => `  * ${type}: ${data.count}회, 총 거리 ${type === 'swimming' ? data.total_distance + 'm' : (data.total_distance / 1000).toFixed(2) + 'km'}, 총 시간 ${Math.round(data.total_duration / 60)}분`).join('\n')}

**현재 설정된 종목별 목표:**
${personalGoals && personalGoals.length > 0 ? personalGoals.map((g: any) => `- ${g.activity_type} (${g.period_type}): ${g.target_value}${g.activity_type === 'swimming' ? 'm' : 'km'}`).join('\n') : '설정된 목표 없음'}

**상세 운동 기록 (최근 20개):**
${workoutSummary.slice(-20).map(w => `- ${w.date}: ${w.type}, ${w.distance_km.toFixed(2)}${w.type === 'swimming' ? 'm' : 'km'}, ${w.duration_minutes}분, 페이스: ${w.pace.toFixed(2)}분/${w.type === 'swimming' ? '100m' : 'km'}${w.avg_heart_rate ? ', 심박수: ' + w.avg_heart_rate + 'bpm' : ''}${w.cadence ? ', 케이던스: ' + w.cadence + 'spm' : ''}`).join('\n')}

---

# Output Format:

### 📊 [데이터 인사이트]
- ({종합 목표} 달성 관점에서 본 현재 데이터의 긍정적 지표 1~2개)

### ⚠️ [문제 & 개선]
- **문제:** (현재 데이터 중 {종합 목표} 달성을 저해하는 요소)
- **개선:** (이를 해결하기 위한 구체적 제안)

### 🧘 [컨디셔닝]
- (현재 운동 패턴에 따른 부상 방지 및 회복 조언)

### 🎯 [도전 목표]
- **주간:** (이번 주 내 달성 가능한 수치)
- **월간:** (이번 달 내 달성 가능한 마일스톤)
- **연간:** ({종합 목표}를 향한 장기적 방향성)

---

**중요: 목표 조정을 제안하는 경우, 답변 마지막에 다음 형식의 JSON을 포함해주세요 (현재 설정된 종목별 목표가 데이터 기반으로 조정이 필요한 경우에만):**
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

// PUT: Save AI coaching result to history
export async function PUT(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { coaching_content, goal_recommendations } = body;

        if (!coaching_content) {
            return NextResponse.json({ error: "코칭 내용이 필요합니다" }, { status: 400 });
        }

        // Save to database
        const { data, error } = await supabase
            .from('ai_coaching_history')
            .insert({
                user_id: user.id,
                coaching_content,
                goal_recommendations: goal_recommendations || null
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, coaching: data });

    } catch (error: any) {
        console.error("Error saving coaching history:", error);
        return NextResponse.json(
            { error: error.message || "코칭 결과 저장에 실패했습니다" },
            { status: 500 }
        );
    }
}
