-- '오지' 회원의 최근 1주일 러닝 거리 확인 쿼리
-- 현재 날짜: 2026-01-24

-- Step 1: '오지' 사용자의 ID 찾기
SELECT id, nickname 
FROM user_profiles 
WHERE nickname = '오지';

-- Step 2: '춘마벼락치기' 크루의 ID 찾기
SELECT id, name 
FROM groups 
WHERE name = '춘마벼락치기';

-- Step 3: '오지'가 해당 크루의 멤버인지 확인
SELECT gm.*, up.nickname, g.name as group_name
FROM group_members gm
JOIN user_profiles up ON gm.user_id = up.id
JOIN groups g ON gm.group_id = g.id
WHERE up.nickname = '오지' AND g.name = '춘마벼락치기';

-- Step 4: 최근 1주일(2026-01-18 ~ 2026-01-24) 러닝 기록 확인
-- user_id는 위 쿼리 결과로 대체해야 함
SELECT 
    workout_date,
    workout_type,
    distance_meters,
    ROUND(distance_meters::numeric / 1000, 2) as distance_km,
    duration_seconds,
    sharing_type
FROM workouts
WHERE user_id = (SELECT id FROM user_profiles WHERE nickname = '오지')
  AND workout_type = 'running'
  AND workout_date >= '2026-01-18'
  AND workout_date <= '2026-01-24'
ORDER BY workout_date DESC;

-- Step 5: 합계 확인
SELECT 
    COUNT(*) as total_workouts,
    SUM(distance_meters) as total_meters,
    ROUND(SUM(distance_meters)::numeric / 1000, 2) as total_km,
    SUM(duration_seconds) as total_seconds
FROM workouts
WHERE user_id = (SELECT id FROM user_profiles WHERE nickname = '오지')
  AND workout_type = 'running'
  AND workout_date >= '2026-01-18'
  AND workout_date <= '2026-01-24';
