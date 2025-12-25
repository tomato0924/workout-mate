# 🏃‍♂️ Workout Mate - 운동 메이트

친구들과 함께하는 소셜 피트니스 플랫폼

## 📋 프로젝트 개요

Workout Mate는 주변 지인들과 운동 기록을 공유하고 상호 작용을 통해 지속적인 운동 동기를 부여받는 소셜 피트니스 웹 애플리케이션입니다.

### 주요 기능

- ✅ **승인 기반 회원가입**: 관리자 승인 후 서비스 이용 가능 (첫 사용자는 자동 슈퍼 관리자)
- 🏃 **운동 기록**: 러닝, 수영, 사이클, 트레드밀, 등산 5가지 운동 종목 지원
- 📸 **사진 공유**: 운동 당 최대 3장의 인증 사진 업로드
- 👥 **그룹 관리**: 그룹 생성, 초대 코드를 통한 가입, 그룹별 운동 피드
- 💬 **소셜 기능**: 운동 기록에 이모지 반응 및 댓글 작성
- 🎯 **관리자 대시보드**: 사용자 및 그룹 승인 관리
- 📱 **반응형 디자인**: 모바일에서도 완벽하게 작동

## 🛠️ 기술 스택

- **Frontend**: Next.js 14 (App Router), TypeScript
- **UI Library**: Mantine UI v7
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel (Frontend), Supabase Cloud (Backend)

## 🚀 로컬 개발 환경 설정

### 1. 사전 요구사항

- Node.js 18.17 이상
- npm 또는 yarn
- Supabase 계정 (무료)

### 2. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 로그인하고 새 프로젝트 생성
2. 프로젝트 설정에서 API 키 확인:
   - Project URL
   - Project API keys > `anon` `public` key

### 3. 데이터베이스 스키마 설정

Supabase 대시보드의 SQL Editor에서 다음 파일들을 순서대로 실행:

```sql
-- 1. 테이블 생성
-- supabase-schema.sql 파일 내용 실행

-- 2. Row Level Security 정책 적용
-- supabase-rls.sql 파일 내용 실행

-- 3. Storage 설정
-- supabase-storage.sql 파일 내용 실행
```

### 4. 프로젝트 설정

1. 저장소 클론 및 의존성 설치:

```bash
cd workout_mate
npm install
```

2. 환경 변수 설정:

`.env.local.example` 파일을 `.env.local`로 복사하고 Supabase 정보 입력:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. 개발 서버 실행:

```bash
npm run dev
```

4. 브라우저에서 http://localhost:3000 접속

### 5. 첫 사용자 생성 (슈퍼 관리자)

1. "회원가입" 클릭
2. 모든 필드 입력 (첫 사용자는 자동으로 슈퍼 관리자 승인)
3. 로그인 후 대시보드 이용

## 📖 사용 가이드

### 운동 기록하기

1. 대시보드에서 "운동 기록" 버튼 클릭
2. 운동 종목 선택
3. 운동 데이터 입력 (거리, 시간, 속도, 심박수 등)
4. 선택사항: 운동 인증 사진 최대 3장 업로드
5. 공유 설정 선택 (전체 공개 / 나만 보기 / 특정 그룹)
6. 저장

### 그룹 관리

**그룹 만들기:**
1. 그룹 메뉴에서 "그룹 생성" 클릭
2. 그 룹명과 설명 입력
3. 관리자 승인 대기
4. 승인 후 초대 코드로 멤버 초대 가능

**그룹 참여하기:**
1. "그룹 참여" 클릭
2. 초대 코드 입력
3. 즉시 그룹 가입

### 관리자 기능

슈퍼 관리자 또는 관리자 권한이 있는 경우:

1. 사이드바에서 "관리자" 메뉴 접근
2. **사용자 승인**: 가입 대기 중인 사용자 승인/거절
3. **그룹 승인**: 생성 요청된 그룹 승인/거절

## 🌐 Vercel 배포

1. GitHub에 저장소 푸시
2. [Vercel](https://vercel.com) 로그인
3. "New Project" 클릭
4. GitHub 저장소 선택
5. 환경 변수 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. "Deploy" 클릭

## 📁 프로젝트 구조

```
workout_mate/
├── app/
│   ├── (auth)/
│   │   ├── login/          # 로그인 페이지
│   │   ├── signup/         # 회원가입 페이지
│   │   └── pending-approval/ # 승인 대기 페이지
│   ├── dashboard/
│   │   ├── page.tsx        # 운동 피드
│   │   ├── workouts/
│   │   │   ├── new/        # 운동 기록 생성
│   │   │   └── [id]/       # 운동 상세 보기
│   │   ├── groups/
│   │   │   ├── page.tsx    # 그룹 목록
│   │   │   └── [id]/       # 그룹 상세
│   │   ├── profile/        # 프로필
│   │   └── admin/          # 관리자 대시보드
│   └── layout.tsx          # 루트 레이아웃
├── components/             # 재사용 가능한 컴포넌트
├── lib/
│   ├── supabase/          # Supabase 클라이언트
│   └── utils/             # 유틸리티 함수
├── types/                 # TypeScript 타입 정의
├── supabase-schema.sql    # 데이터베이스 스키마
├── supabase-rls.sql       # Row Level Security 정책
└── supabase-storage.sql   # Storage 설정
```

## 🔒 보안 및 권한

- **Row Level Security (RLS)**: 모든 테이블에 적용되어 데이터 접근 제어
- **승인 워크플로우**: 신규 사용자와 그룹은 관리자 승인 필요
- **첫 사용자 특례**: 시스템 최초 가입자는 자동 슈퍼 관리자 권한

## 🐛 문제 해결

### 로그인이 안 돼요
- Supabase 프로젝트 URL과 API 키가 올바른지 확인
- 사용자 승인 상태 확인 (pending인 경우 관리자 승인 필요)

### 이미지 업로드가 안 돼요
- Supabase Storage 버킷 `workout-images`가 생성되었는지 확인
- Storage 정책이 올바르게 설정되었는지 확인

### 데이터가 안 보여요
- Supabase RLS 정책이 올바르게 적용되었는지 확인
- 브라우저 콘솔에서 에러 메시지 확인

## 📝 라이선스

이 프로젝트는 개인 및 학습 목적으로 자유롭게 사용할 수 있습니다.

## 🤝 기여

이슈나 개선 사항이 있으시면 언제든지 제안해주세요!

---

**Made with ❤️ for fitness enthusiasts**
