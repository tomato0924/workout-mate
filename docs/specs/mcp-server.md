# Workout Mate MCP 서버 (PlayMCP 등록용) 설계안

상태: 구현 중 (2026-11-28, 브랜치 `feat/mcp-server`)

## 1. 목표

카카오 PlayMCP에 Workout Mate를 MCP 서버로 등록해, 사용자가 카카오 툴즈나 ChatGPT, Claude 대화창에서
앱을 열지 않고 운동 기록·크루 소식·대회 일정·공지를 조회하고 간단한 기록과 응원을 남길 수 있게 한다.
같은 도구함에 담긴 **톡캘린더**(대회 일정 등록)와 **나챗방**(요약 받기) MCP와 함께 쓰면 효과가 커진다.

## 2. PlayMCP 등록 요건 (서버 개발 가이드 2026-10-06, 심사 정책 기준)

| 항목 | 요건 | 이 설계의 대응 |
|---|---|---|
| 프로토콜 | MCP 2025-03-26 ~ 2025-11-25 | 공식 TypeScript SDK 사용 |
| 전송 | Streamable HTTP만, 공개 URL의 Remote 서버 | `POST /api/mcp` (Vercel 운영 도메인) |
| 상태 | Stateless 권장 | 세션 없이 요청마다 인증 |
| 인증 | OAuth 또는 커스텀 헤더 | v1: 커스텀 헤더(TOKEN), v2에서 OAuth 검토 |
| 툴 개수 | 20개 이하, 3~10개 권장 | 10개 |
| 툴 이름 | `[A-Za-z0-9_-]`, 1~128자, `kakao` 포함 금지 | snake_case 영문 |
| 툴 속성 | name, description, inputSchema, annotations 필수. annotations는 title, readOnlyHint, destructiveHint, openWorldHint, idempotentHint를 **모두** 지정 | 툴마다 명시 |
| 응답 | PlayMCP AI 채팅은 `TextContent`만 허용, Markdown 권장, JSON 원문 비권장, 이미지는 `![](url)` | 모든 툴이 Markdown 텍스트 반환 |
| 사전 점검 | MCP Inspector로 스펙 준수 확인 | 등록 전 Inspector 점검 |
| 공개 | 심사 후 기본은 "나에게만 공개". 크루원이 쓰려면 "전체 공개"로 전환해야 함 | 전체 공개 (계정·키 없이는 사용 불가) |

## 3. 인증 설계

### v1: 개인 연결 키 (PlayMCP `TOKEN` 방식)

1. 사용자가 **내 정보 > AI 비서 연결**에서 "연결 키 발급"을 누른다. 키(`wm_` + 랜덤 32바이트)는 **한 번만 화면에 보여 준다**.
2. PlayMCP 도구함에 Workout Mate를 추가할 때 헤더 `X-Workout-Mate-Key`에 키를 붙여 넣는다.
3. MCP 요청이 들어오면 서버는 키의 SHA-256 해시로 `mcp_api_keys`를 조회해 `user_id`를 찾는다.
   `revoked_at`이 비어 있고 사용자가 `approval_status = 'approved'`일 때만 통과시킨다.
4. 사용자는 언제든 키를 폐기하거나 다시 발급할 수 있다. `last_used_at`을 보여 준다.

선택 이유: 지인 대상 서비스라 사용자 수가 적고, OAuth 인가 서버를 새로 만드는 것보다 구현과 운영이 단순하다.
PlayMCP에도 같은 방식으로 승인된 MCP가 여럿 있다.

### 데이터 접근과 권한

키 인증에는 Supabase 세션이 없어서 RLS가 자동으로 걸리지 않는다. 따라서:

- 서버에서 service role 클라이언트(`createAdminClient`)를 쓰되, **모든 조회를 `lib/mcp/access.ts`의 헬퍼로만** 하게 한다.
  헬퍼는 RLS 규칙을 그대로 옮긴다. 운동은 `public`, 또는 본인 기록, 또는 `group`이면서 내가 그 크루 멤버인 경우만 보인다.
  크루 데이터는 멤버일 때만 조회한다.
- 관리자 권한(전체 열람)은 MCP에서 **쓰지 않는다**. 관리자도 일반 사용자 범위로만 동작한다.
- 쓰기 툴은 `user_id`를 항상 키 소유자로 강제한다.

### v2 (선택): OAuth

Supabase Auth의 OAuth 서버 기능을 쓰면 사용자 액세스 토큰으로 RLS가 그대로 적용된다.
대신 동의 화면을 구현해야 하고, PlayMCP가 보내 주는 Redirect URI를 24시간 안에 설정해야 한다.
v1을 운영해 보고 나서 판단한다.

## 4. 툴 목록 (10개)

| # | 이름 | 설명 | 읽기 전용 | 파괴적 | 멱등 |
|---|---|---|---|---|---|
| 1 | `get_my_summary` | 이번 주/이번 달/올해 종목별 거리·시간·횟수와 개인 목표 달성률 | ✅ | ❌ | ✅ |
| 2 | `list_my_workouts` | 기간·종목으로 내 운동 기록 목록 조회 (페이스·심박·케이던스·SWOLF 포함) | ✅ | ❌ | ✅ |
| 3 | `log_workout` | 운동 기록 작성 (종목, 날짜, 거리, 시간, 선택 지표, 공유 범위). 기본 공유 범위는 `public`이며, 사용자가 원하면 `private` 또는 특정 크루로 등록 | ❌ | ❌ | ❌ |
| 4 | `list_my_crews` | 내가 속한 크루 목록과 크루 목표 | ✅ | ❌ | ✅ |
| 5 | `get_crew_leaderboard` | 크루의 주간/월간 종목별 순위와 목표 진행률 | ✅ | ❌ | ✅ |
| 6 | `get_crew_feed` | 크루에 공유된 최근 운동 기록 (이름, 종목, 거리, 반응 수, 기록 링크) | ✅ | ❌ | ✅ |
| 7 | `cheer_workout` | 크루원 기록에 이모지 반응 또는 응원 댓글 남기기 (기존 알림 흐름으로 푸시 발송) | ❌ | ❌ | ❌ |
| 8 | `search_competitions` | 기간·종목·지역으로 대회 일정 검색 (접수 기간, 참가 크루원 포함) | ✅ | ❌ | ✅ |
| 9 | `join_competition` | 대회 참가 표시 또는 취소 | ❌ | ❌ | ✅ |
| 10 | `get_announcements` | 운영자 최근 공지 조회 | ✅ | ❌ | ✅ |

공통: `openWorldHint: false` (우리 DB만 다룸). 응답 끝에 앱 딥링크(`https://<도메인>/dashboard/workouts/<id>` 등)를 붙여서 앱으로 이어지게 한다.

v1에서 뺀 것: 기록 삭제·수정, 사진 업로드, 크루 가입·생성, 관리자 기능.
파괴적이거나 앱 UI가 더 적합한 작업이다.

### 함께 쓰는 시나리오 (심사용 "대화 예시"에도 사용)

- "어제 한강에서 10km 52분 뛰었어. 크루에 공유해줘" → `log_workout`
- "우리 크루 이번 주 러닝 순위 알려줘" → `get_crew_leaderboard`
- "내년 봄 하프 마라톤 찾아서 접수일을 톡캘린더에 넣어줘" → `search_competitions` + 톡캘린더 `CreateEvent`
- "이번 달 내 운동 요약을 나챗방에 보내줘" → `get_my_summary` + 나챗방 `MemoChat`
- "민수 어제 기록에 👏 남겨줘" → `get_crew_feed` + `cheer_workout`

## 5. 구현 구성

```
app/api/mcp/route.ts        Streamable HTTP 엔드포인트 (POST, stateless). GET/DELETE는 405
lib/mcp/auth.ts             X-Workout-Mate-Key 검증 → userId
lib/mcp/access.ts           RLS를 옮긴 조회 헬퍼 (볼 수 있는 운동, 크루 멤버 확인)
lib/mcp/tools/*.ts          툴 정의 (zod inputSchema + annotations + Markdown 포맷터)
lib/mcp/format.ts           Markdown 표·페이스 포맷 (lib/utils/format.ts 재사용)
app/dashboard/profile/      "AI 비서 연결" 섹션: 키 발급/폐기, 연결 방법 안내
app/api/mcp-keys/route.ts   키 발급(POST)/목록(GET)/폐기(DELETE). 쿠키 세션 인증
db/migrations/024_create_mcp_api_keys.sql
```

- 의존성: `@modelcontextprotocol/sdk`, `zod`. 설치 시점의 SDK가 지원하는 프로토콜 버전이 PlayMCP 범위 안인지 확인한다.
- `middleware.ts`의 세션 갱신이 `/api/mcp`를 막지 않는지 확인한다 (보호 경로 아님).
- 남용 방지: 키당 분당 요청 수 제한(간단한 메모리 카운터 또는 `last_used_at` 기반)과 입력 길이 제한(댓글 300자)을 둔다.
- 기존 재사용: 요약·순위는 `lib/recap/*`, 대회는 `lib/competitions.ts`, 페이스는 `lib/utils/format.ts`.

## 6. DB 변경 (024)

```sql
CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,          -- sha256(hex), 원문은 저장하지 않음
  key_prefix text NOT NULL,               -- 화면 표시용 앞 8자 (wm_xxxxx)
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS mcp_api_keys_user_idx ON public.mcp_api_keys(user_id);

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;
-- 본인 키 메타데이터만 조회 가능. 발급·폐기는 API 라우트(service role)에서만 수행
CREATE POLICY "Users can view own mcp keys" ON public.mcp_api_keys
  FOR SELECT USING (user_id = auth.uid());
```

사용자당 활성 키는 최대 3개로 제한한다 (API에서 검사).

## 7. 일정과 검증

1. 마이그레이션 024 적용 (사용자가 SQL Editor에서 실행)
2. 키 발급 UI와 API
3. MCP 엔드포인트와 읽기 툴 7개 → MCP Inspector로 로컬 점검
4. 쓰기 툴 3개 (알림 INSERT로 푸시까지 확인)
5. `tsc` / `build` → PR → Vercel 미리보기 URL로 Inspector 점검
6. 운영 배포 후 PlayMCP 개발자 콘솔에 등록 (이름에 `kakao` 금지, 대화 예시 작성) → 심사 → 전체 공개
7. 공지(`announcements`)로 사용 방법 안내 (문구는 사용자 확인 후 등록)

## 8. 결정 사항 (2026-11-28)

- PlayMCP 공개 목록에 Workout Mate가 노출되는 것은 괜찮다. 키가 없으면 사용할 수 없다.
- `log_workout`의 기본 공유 범위는 `public`이다. 사용자가 원하면 `private`이나 특정 크루로 바꿔서 등록한다.
- PlayMCP 등록은 운영자(관리자) 본인의 카카오 계정으로 한다.
