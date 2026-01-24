-- Personal goals 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'personal_goals'
ORDER BY ordinal_position;

-- 현재 설정된 목표 확인
SELECT * FROM personal_goals
WHERE user_id = (SELECT id FROM user_profiles WHERE email = 'YOUR_EMAIL')
ORDER BY activity_type, period_type;

-- Unique constraint 확인
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'personal_goals';
