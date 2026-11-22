-- 최근 1주일(2026-01-18 ~ 2026-01-24) 운동 기록 전체 추출
-- 현재 날짜: 2026-01-24

-- 1. 기본 운동 기록 조회 (이미지, 반응, 댓글 포함)
SELECT 
    w.id,
    w.workout_type,
    w.workout_date,
    w.duration_seconds,
    w.distance_meters,
    w.avg_heart_rate,
    w.cadence,
    w.swolf,
    w.sharing_type,
    w.shared_group_id,
    w.view_count,
    w.created_at,
    -- 사용자 정보
    up.nickname,
    up.email,
    -- 이미지 개수
    (SELECT COUNT(*) FROM workout_images WHERE workout_id = w.id) as image_count,
    -- 반응 개수
    (SELECT COUNT(*) FROM workout_reactions WHERE workout_id = w.id) as reaction_count,
    -- 댓글 개수
    (SELECT COUNT(*) FROM workout_comments WHERE workout_id = w.id) as comment_count
FROM workouts w
JOIN user_profiles up ON w.user_id = up.id
WHERE w.user_id = (SELECT id FROM user_profiles WHERE email = 'YOUR_EMAIL_HERE')
  AND w.workout_date >= '2026-01-18'
  AND w.workout_date <= '2026-01-24'
ORDER BY w.workout_date DESC, w.created_at DESC;

-- 2. 이미지 URL 포함한 상세 조회
SELECT 
    w.id as workout_id,
    w.workout_type,
    w.workout_date,
    ROUND(w.distance_meters::numeric / 1000, 2) as distance_km,
    w.distance_meters,
    FLOOR(w.duration_seconds / 3600) || '시간 ' || 
    FLOOR((w.duration_seconds % 3600) / 60) || '분 ' || 
    (w.duration_seconds % 60) || '초' as duration_formatted,
    w.avg_heart_rate,
    w.cadence,
    w.swolf,
    w.sharing_type,
    w.view_count,
    up.nickname,
    -- 이미지 정보
    array_agg(DISTINCT wi.image_url) FILTER (WHERE wi.image_url IS NOT NULL) as images,
    -- 반응 정보
    array_agg(DISTINCT wr.emoji) FILTER (WHERE wr.emoji IS NOT NULL) as reactions
FROM workouts w
JOIN user_profiles up ON w.user_id = up.id
LEFT JOIN workout_images wi ON w.id = wi.workout_id
LEFT JOIN workout_reactions wr ON w.id = wr.workout_id
WHERE w.user_id = (SELECT id FROM user_profiles WHERE email = 'YOUR_EMAIL_HERE')
  AND w.workout_date >= '2026-01-18'
  AND w.workout_date <= '2026-01-24'
GROUP BY w.id, up.nickname
ORDER BY w.workout_date DESC, w.created_at DESC;

-- 3. 운동 종목별 통계
SELECT 
    workout_type,
    COUNT(*) as workout_count,
    SUM(distance_meters) as total_meters,
    ROUND(SUM(distance_meters)::numeric / 1000, 2) as total_km,
    SUM(duration_seconds) as total_seconds,
    ROUND(SUM(duration_seconds)::numeric / 3600, 2) as total_hours,
    ROUND(AVG(distance_meters)::numeric / 1000, 2) as avg_distance_km,
    ROUND(AVG(duration_seconds)::numeric / 60, 2) as avg_duration_minutes
FROM workouts
WHERE user_id = (SELECT id FROM user_profiles WHERE email = 'YOUR_EMAIL_HERE')
  AND workout_date >= '2026-01-18'
  AND workout_date <= '2026-01-24'
GROUP BY workout_type
ORDER BY workout_type;

-- 4. 전체 요약 통계
SELECT 
    COUNT(*) as total_workouts,
    COUNT(DISTINCT workout_date) as total_workout_days,
    SUM(distance_meters) as total_meters,
    ROUND(SUM(distance_meters)::numeric / 1000, 2) as total_km,
    SUM(duration_seconds) as total_seconds,
    ROUND(SUM(duration_seconds)::numeric / 3600, 2) as total_hours,
    ROUND(AVG(distance_meters)::numeric / 1000, 2) as avg_distance_km,
    ROUND(AVG(duration_seconds)::numeric / 60, 2) as avg_duration_minutes,
    ROUND(AVG(avg_heart_rate), 0) as avg_heart_rate_overall
FROM workouts
WHERE user_id = (SELECT id FROM user_profiles WHERE email = 'YOUR_EMAIL_HERE')
  AND workout_date >= '2026-01-18'
  AND workout_date <= '2026-01-24';

-- 사용 방법:
-- 위 쿼리의 'YOUR_EMAIL_HERE'를 본인의 이메일 주소로 변경하여 Supabase SQL Editor에서 실행하세요.
-- 또는 이메일 대신 user_id를 직접 사용할 수도 있습니다.
