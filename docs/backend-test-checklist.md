1. 인증 및 권한 관리 (Authentication & Authorization)
가장 중요한 보안 및 진입점 로직입니다.

[트리거] 첫 번째 사용자 자동 승인 로직 (handle_first_user_signup)
테스트 케이스: 데이터베이스가 비어있는 상태에서 첫 번째 사용자로 가입 시도.
확인 사항: user_profiles 테이블에 role이 super_admin, approval_status가 approved로 정확히 저장되는지 확인.
디버깅 포인트: 트리거가 auth.users 생성 시점과 미묘하게 어긋나거나 Race Condition이 발생하는지 확인.
[RLS] 승인 대기 사용자 접근 차단 (policy: Users can view approved users)
테스트 케이스: 두 번째 사용자(일반 유저)로 가입 후 pending 상태일 때 로그인 시도.
확인 사항: 대시보드 진입 시 데이터 로딩 실패 또는 리다이렉트가 정상 작동하는지. 백엔드단에서 pending 유저의 읽기 권한이 제한되는지 확인.
[클라이언트-백엔드] 중복 가입 방지
테스트 케이스: 이미 가입된 이메일로 회원가입 시도.
확인 사항: Supabase의 고유 제약 조건(Unique Constraint) 에러가 클라이언트에 적절히 전달되는지.
2. 그룹 관리 시스템 (Group Management)
데이터 무결성과 관계형 데이터 처리가 복잡한 부분입니다.

[트리거] 그룹 생성 시 소유자 자동 멤버 추가 (add_owner_to_group)
테스트 케이스: 그룹 생성 즉시 group_members 테이블 조회.
확인 사항: 그룹을 만든 사람(owner_id)이 자동으로 해당 그룹의 멤버(group_members)로 Insert 되었는지 확인. 이 트리거가 실패하면 그룹을 만들었는데 본인이 글을 못 쓰는 상황이 발생함.
[제약조건] 초대 코드 유일성 (Unique Invite Code)
테스트 케이스: 수동으로 DB에서 이미 존재하는 초대 코드로 그룹 생성 시도.
확인 사항: 
invite_code
 컬럼의 Unique Constraint가 작동하여 에러를 발생시키는지 확인. 생성 함수에서 난수 발생 충돌 처리 로직 검증.
[RLS] 비공개/그룹 데이터 격리
테스트 케이스: A 그룹의 멤버가 아닌 사용자가 API를 통해 A 그룹의 게시글(group_posts) 조회 시도.
확인 사항: RLS 정책에 의해 결과가 Empty Array([])로 반환되어야 함. (에러가 아니라 빈 결과가 나와야 정상 보안).
3. 운동 기록 및 미디어 (Workout Logging)
데이터 타입과 스토리지 연동을 확인해야 합니다.

[데이터 무결성] 운동 종목별 필수/선택 필드 저장
테스트 케이스: '수영' 종목 선택 후 swolf 값을 입력하고 저장. 반대로 '러닝' 선택 후 swolf 값 저장 시도.
확인 사항: 프론트엔드 유효성 검사를 뚫고 들어온 요청에 대해 DB 수준에서 제약조건(CHECK constraint)이 필요한지, 혹은 NULL 처리가 잘 되는지 확인.
[스토리지] 이미지 업로드 권한 및 경로
테스트 케이스: 로그인하지 않은 상태(혹은 토큰 만료)에서 스토리지 직접 업로드 시도.
확인 사항: 
supabase-storage.sql
에 설정된 Authenticated users can upload 정책이 작동하여 403 에러가 발생하는지.
경로 검증: 저장된 파일 경로가 userId/workoutId/timestamp 형식을 준수하여 다른 사용자의 파일을 덮어쓰지 않는지 확인.
4. 관리자 기능 (Admin Features)
권한 상승 및 시스템 제어 로직입니다.

[RLS] 관리자 전용 데이터 조회 (policy: Admins can view all...)
테스트 케이스: 일반 사용자(user role) 계정으로 관리자 API(예: 전체 사용자 목록 조회) 호출.
확인 사항: RLS 정책에 의해 데이터가 반환되지 않아야 함. 오직 role이 admin 또는 super_admin인 경우에만 전체 조회가 되는지 확인.
[업데이트] 승인 상태 변경 로직
테스트 케이스: 관리자가 대기 중인 사용자를 '거절(rejected)' 처리.
확인 사항: 해당 사용자의 approval_status 컬럼이 즉시 업데이트되고, 해당 사용자의 세션에서 접근 권한이 즉시 박탈되는지 확인(RLS 정책 반영 여부).
특히 집중해서 테스트해야 할 '위험 구간' ⚠️
가장 버그가 많이 발생하는 Top 3 구간입니다. 우선적으로 확인해보세요.

회원가입 직후의 Race Condition: auth.users에는 생겼는데 public.user_profiles 트리거가 늦게 돌아서 프로필이 없는 찰나의 순간에 로그인을 시도할 때 에러가 나는지.
