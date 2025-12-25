# Workout Mate 로컬 설정 가이드

이 가이드는 Workout Mate 애플리케이션을 로컬 환경에서 실행하는 단계별 지침입니다.

## 📋 1단계: 사전 준비

### 필수 설치 항목

- **Node.js 18.17 이상**: [nodejs.org](https://nodejs.org)에서 다운로드
- **npm** (Node.js와 함께 설치됨)
- **Git**: 코드 관리를 위해 필요
- **Supabase 계정**: [supabase.com](https://supabase.com)에서 무료 가입

## 🗄️ 2단계: Supabase 프로젝트 생성

### 2.1 새 프로젝트 만들기

1. [Supabase 대시보드](https://app.supabase.com)에 로그인
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - **Name**: workout-mate (또는 원하는 이름)
   - **Database Password**: 강력한 비밀번호 설정 (잘 기록해두세요)
   - **Region**: 가장 가까운 지역 선택 (예: Northeast Asia (Seoul))
4. "Create new project" 클릭
5. 프로젝트 생성 완료까지 약 2분 대기

### 2.2 API 키 확인

1. Supabase 프로젝트 대시보드에서 ⚙️ Settings 클릭
2. "API" 메뉴 선택
3. 다음 정보를 메모장에 복사:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (긴 문자열)

## 🗃️ 3단계: 데이터베이스 스키마 설정

### 3.1 SQL 에디터 열기

1. Supabase 대시보드 왼쪽 메뉴에서 🛢️ **SQL Editor** 클릭
2. "New query" 버튼 클릭

### 3.2 테이블 생성

1. `supabase-schema.sql` 파일 내용 전체를 복사
2. SQL 에디터에 붙여넣기
3. 우측 하단 "Run" 버튼 클릭 (또는 Ctrl+Enter)
4. 성공 메시지 확인: "Success. No rows returned"

### 3.3 Row Level Security 정책 적용

1. 새로운 쿼리 생성 ("New query")
2. `supabase-rls.sql` 파일 내용 전체를 복사
3. SQL 에디터에 붙여넣기
4. "Run" 버튼 클릭
5. 성공 확인

### 3.4 Storage 버킷 생성

1. 새로운 쿼리 생성
2. `supabase-storage.sql` 파일 내용을 복사
3. SQL 에디터에 붙여넣기
4. "Run" 버튼 클릭

**또는** 수동으로 Storage 버킷 생성:

1. 왼쪽 메뉴에서 🗂️ **Storage** 클릭
2. "Create a new bucket" 클릭
3. Bucket 정보 입력:
   - **Name**: `workout-images`
   - **Public bucket**: ✅ 체크
4. "Create bucket" 클릭

## 💻 4단계: 애플리케이션 설정

### 4.1 의존성 설치

프로젝트 디렉토리로 이동하여 다음 명령 실행:

```bash
cd c:\Users\tomat\projects\workout_mate
npm install
```

설치 완료까지 약 2-5분 소요

### 4.2 환경 변수 설정

1. `.env.local.example` 파일을 `.env.local`로 복사:

```bash
# Windows PowerShell
Copy-Item .env.local.example .env.local
```

2. `.env.local` 파일을 텍스트 에디터로 열기
3. 2단계에서 복사한 Supabase 정보로 수정:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ **중요**: `your-project-id`와 `your-anon-key-here`를 실제 값으로 교체하세요!

## 🚀 5단계: 애플리케이션 실행

### 5.1 개발 서버 시작

```bash
npm run dev
```

다음과 같은 메시지가 표시되면 성공:

```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Ready in 2.3s
```

### 5.2 브라우저에서 접속

웹 브라우저를 열고 http://localhost:3000 접속

## 👤 6단계: 첫 사용자 생성 (슈퍼 관리자)

### 6.1 회원가입

1. "회원가입" 링크 클릭
2. 모든 필드 입력:
   - **이메일**: 유효한 이메일 주소
   - **이름**: 실명
   - **닉네임**: 표시될 이름
   - **연락처**: 전화번호
   - **비밀번호**: 최소 6자
   - **비밀번호 확인**: 동일한 비밀번호

3. "회원가입" 버튼 클릭

### 6.2 자동 승인 확인

첫 번째 사용자는 **자동으로 슈퍼 관리자 권한**이 부여되며 즉시 대시보드로 이동합니다.

> ✅ 성공 메시지: "환영합니다! 첫 번째 사용자로 슈퍼 관리자 권한이 부여되었습니다"

## 🧪 7단계: 기능 테스트

### 7.1 운동 기록 생성

1. 대시보드에서 "운동 기록" 버튼 클릭
2. 운동 종목 선택 (예: 러닝)
3. 데이터 입력:
   - 운동 일자: 오늘 날짜
   - 운동 시간: 30분
   - 거리: 5km
   - 평균 속도: 10km/h
4. (선택) 사진 추가
5. 공유 설정: "전체 공개"
6. "저장" 클릭

### 7.2 그룹 생성

1. 사이드바에서 "그룹" 클릭
2. "그룹 생성" 버튼 클릭
3. 그룹 정보 입력:
   - 그룹명: "아침 러닝 모임"
   - 그룹 설명: "매일 아침 함께 뛰는 모임"
4. "생성하기" 클릭
5. 관리자 승인 대기 메시지 확인

### 7.3 그룹 승인 (슈퍼 관리자)

1. 사이드바에서 "관리자" 클릭
2. "그룹 승인" 탭 선택
3. 방금 생성한 그룹의 "승인" 버튼 클릭
4. "그룹" 메뉴로 돌아가서 승인된 그룹 확인

### 7.4 두 번째 사용자 테스트

1. 브라우저의 **시크릿 모드** 또는 **다른 브라우저** 열기
2. http://localhost:3000 접속
3. 다른 계정으로 회원가입
4. "관리자 승인 대기 중" 페이지 확인
5. 첫 번째 브라우저(슈퍼 관리자)로 돌아가기
6. 관리자 > 사용자 승인에서 새 사용자 승인
7. 두 번째 브라우저에서 "승인 상태 확인" 버튼 클릭
8. 대시보드 접근 확인

## 🔧 문제 해결

### "Cannot connect to Supabase" 오류

**원인**: 환경 변수가 올바르지 않음

**해결책**:
1. `.env.local` 파일 확인
2. Supabase URL과 API 키가 정확한지 재확인
3. 개발 서버 재시작 (Ctrl+C 후 `npm run dev`)

### "User not found" 오류

**원인**: 데이터베이스 스키마가 올바르게 생성되지 않음

**해결책**:
1. Supabase 대시보드 > Table Editor에서 `user_profiles` 테이블 존재 확인
2. 없다면 3단계의 SQL 스크립트 다시 실행

### "Permission denied" 오류

**원인**: RLS 정책이 올바르게 설정되지 않음

**해결책**:
1. Supabase 대시보드 > Authentication > Policies 확인
2. `supabase-rls.sql` 스크립트 다시 실행

### 이미지 업로드 실패

**원인**: Storage 버킷이 생성되지 않음

**해결책**:
1. Supabase 대시보드 > Storage 메뉴로 이동
2. `workout-images` 버킷 존재 확인
3. 없다면 수동으로 생성 (Public bucket으로)

## 📱 모바일에서 테스트

로컬 네트워크에서 모바일 기기로 테스트하려면:

1. PC의 로컬 IP 주소 확인:
   ```bash
   ipconfig  # Windows
   ```

2. 모바일 브라우저에서 접속:
   ```
   http://192.168.x.x:3000
   ```
   (192.168.x.x는 PC의 IP 주소)

## 🌐 다음 단계: Vercel 배포

로컬 테스트가 완료되면 [README.md](./README.md)의 "Vercel 배포" 섹션을 참고하여 프로덕션 배포를 진행하세요.

---

**문제가 해결되지 않으면 이슈를 등록해주세요!**
