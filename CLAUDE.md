# CLAUDE.md

Workout Mate(운동 메이트): 지인들끼리 운동 기록을 공유하는 소셜 피트니스 PWA. 사용자와 대화·커밋 메시지·UI 문구는 모두 **한국어**.
(이 프로젝트는 Antigravity(Gemini)에서 작업하다 2026-11에 Claude Code로 이전됨.)

## 명령어

```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npx tsc --noEmit     # 타입 체크: 변경 후 항상 실행
npm run build        # 프로덕션 빌드 검증 (useSearchParams/Suspense 오류 등은 빌드에서만 잡힘)
npm run lint
```

자동화된 테스트 프레임워크는 없음 (`testsprite_tests/`는 외부 도구가 만든 Python 테스트로 일상 검증에 쓰지 않음). 검증은 `tsc` + `build` + 브라우저 수동 확인.

## 기술 스택

- Next.js 14 App Router + TypeScript, React 18 (`reactStrictMode: false`)
- UI: **Mantine v7** (`@mantine/core`, dates, carousel, dropzone, notifications) + `@tabler/icons-react`. Tailwind 없음.
- 백엔드: **Supabase** (Postgres + Auth + Storage, RLS). 요구사항 문서의 Firebase Firestore 기술 스택은 채택되지 않았음.
- 푸시 알림: Firebase Cloud Messaging (클라이언트 `firebase`, 서버 `firebase-admin`)
- AI: Google Gemini (`@google/generative-ai`, 모델 `gemini-2.5-flash`)
- 기타: dayjs, recharts, react-markdown, xlsx(엑셀 내보내기), Vercel Analytics
- 배포: Vercel (GitHub `main` 푸시 → 자동 배포), origin: github.com/tomato0924/workout-mate

## 구조

- `app/dashboard/` — 로그인 후 화면. `layout.tsx`가 공통 네비게이션(대시보드 / 크루 / 대회일정 / 내 정보 / 관리자).
  - `page.tsx`: 탭 `my_workout`(`components/dashboard/MyWorkoutTab.tsx`, 요약 캐러셀·목표·AI 코칭·AI 독려 메시지) / `feed`(`FeedTab.tsx`)
  - `groups/` 크루 목록·상세, `competitions/` 대회 캘린더·목록·상세 패널, `workouts/` 기록 작성·상세·수정, `profile/` 내 정보(아바타, 알림 설정, 엑셀 내보내기), `admin/` 관리자(`components/admin/*`)
- `app/api/` — 서버 라우트. AI(`ai-workout-advice`, `analyze-workout-image`, `dashboard-encouragement`), 푸시(`notifications/push`), 관리자(`admin/*`), `signup`, `groups`, `workouts`.
- `lib/supabase/` — `client.ts`(브라우저), `server.ts`(서버 컴포넌트/라우트, 쿠키), `admin.ts`(service role, **서버 전용**), `middleware.ts`(세션 갱신 + 보호 경로 리다이렉트)
- `lib/firebase/` — `fcm.ts`(클라이언트 토큰 발급), `admin.ts`(서버 발송); `public/firebase-messaging-sw.js`(서비스 워커)
- `lib/competitions.ts` — 대회 데이터 조회 헬퍼. `lib/utils/` — 상수·포맷(페이스 등)·헬퍼
- `types/index.ts` — 모든 도메인 타입 (UserProfile, Group, Workout, Competition, Announcement 등)

## 도메인 규칙

- UI에서는 "그룹"을 **"크루"**라고 부름 (DB 테이블명은 `groups`).
- 운동 종목은 `running | swimming | cycling | hiking` 4종 (트레드밀은 러닝으로 통합됨, 사이클은 파워 지표 있음). 특화 지표: 케이던스(러닝), SWOLF(수영).
- 가입은 승인제: 신규 가입자 `approval_status = 'pending'` → 관리자 승인. 첫 가입자는 자동 super_admin. 역할: `super_admin | admin | user`.
- 공유 범위: `public | private | group`. 운동 인증 사진 최대 3장.
- 사용자 대상 업데이트 공지는 `announcements` 테이블에 등록(팝업 + 전체 알림). 공지 문구는 사용자 확인 후 등록.

## 데이터베이스 변경

마이그레이션 도구 없음. 루트의 `*.sql` 파일을 **Supabase 대시보드 SQL Editor에서 사용자가 직접 실행**하는 방식.
- 기본 스키마: `supabase-schema.sql` → `supabase-rls.sql` → `supabase-storage.sql`, 이후 기능별 `*_migration.sql`, `add_*.sql`, `create_*.sql`, `fix_*.sql`.
- 스키마 변경 시: 새 SQL 파일을 루트에 만들고 `types/index.ts` 타입도 갱신, 사용자에게 실행을 요청. RLS 정책 누락/재귀 정책(과거 `fix_recursive_*` 이슈) 주의.

## 환경 변수 (`.env.local`, git 제외)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `PUSH_WEBHOOK_SECRET`. Vercel에도 동일하게 설정되어 있어야 함.
Supabase 키는 신규 형식(`sb_publishable_…`, `sb_secret_…`)을 사용하며 Legacy JWT 키는 비활성화됨(2026-11, 키 노출 사고 후 교체).

## 푸시 알림 흐름

`notifications` 테이블 INSERT → Supabase Database Webhook → `POST /api/notifications/push` → FCM 발송.
이 라우트는 `x-webhook-secret` 헤더를 `PUSH_WEBHOOK_SECRET`과 비교해 검증하며, 환경 변수가 없으면 모든 요청을 401로 거부함.

## 주의사항 (과거에 겪은 문제)

- `useSearchParams` 사용하는 클라이언트 컴포넌트는 반드시 `<Suspense>`로 감쌀 것 (빌드 실패 원인).
- FCM: `public/firebase-messaging-sw.js`의 CDN `importScripts` 버전은 `package.json`의 `firebase` 버전과 **반드시 일치**시킬 것 (불일치 시 `token-subscribe-failed`). VAPID 키는 `lib/firebase/fcm.ts`에 하드코딩.
- `createAdminClient()`(service role)는 API 라우트에서만 사용. 클라이언트 컴포넌트에 import 금지.
- AI 독려 메시지는 클라이언트 localStorage에 12시간 캐시.
- 이미지는 `**.supabase.co` 원격 패턴만 허용(`next.config.mjs`).
- `MyWorkoutTab.tsx`(~1800줄), `competitions/page.tsx`, `profile/page.tsx`는 매우 큼 — 필요한 부분만 읽고 수정.

## 루트의 잡동사니 파일

`update*.js`, `apply_jsx*.js`, `transform_page.*`, `build_output.txt`, `lint.txt`, `tsc_output*.txt`, `detail_block.txt`, `list_models.js`, `test_api.js`, `temp/`, `tmp/`, `AI_GOAL_RECOMMENDATIONS_CODE.txt` 등은 Antigravity가 남긴 일회성 스크립트/출력물로 앱 코드가 아님. 참고하거나 수정하지 말 것.

## 작업 방식

- 기능 단위로 계획 → (필요 시 사용자 확인) → 구현 → `npx tsc --noEmit`/`npm run build` 확인 → 커밋.
- 커밋 메시지: Conventional 접두어 + 한국어 요약. 예) `feat: 크루 최근 활동 미니 피드에 사용자 아바타 노출 추가`, `fix(competitions): ...`
- 지금까지는 `main`에 직접 커밋·푸시해왔음. 푸시(=Vercel 배포)는 사용자 요청 시에만.
