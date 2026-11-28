// Workout Mate MCP 툴 점검 스크립트 (기본은 읽기 툴만, --write 시 쓰기 툴까지)
//
// 사용법 (PowerShell):
//   $env:MCP_KEY = "wm_..."                           # 내 정보 > AI 비서 연결에서 발급한 키
//   $env:MCP_URL = "http://localhost:3000/api/mcp"    # 생략 시 이 값. 미리보기 URL도 가능
//   $env:MCP_ACCEPT = "application/json"            # (선택) Accept 헤더를 바꿔 호환성 확인
//   $env:VERCEL_BYPASS = "..."                         # 보호된 Vercel 미리보기일 때만: Protection Bypass for Automation 시크릿
//   node scripts/mcp-smoke.mjs            # 읽기 툴만
//   node scripts/mcp-smoke.mjs --write    # 쓰기 툴까지 ('나만 보기' 테스트 기록 1건 생성됨)
//
// 키는 출력하지 않는다.

const url = process.env.MCP_URL || 'http://localhost:3000/api/mcp';
const key = process.env.MCP_KEY;
if (!key) {
    console.error('MCP_KEY 환경 변수에 연결 키를 넣어 주세요.');
    process.exit(1);
}

const REQUIRED_ANNOTATIONS = ['title', 'readOnlyHint', 'destructiveHint', 'openWorldHint', 'idempotentHint'];
const TOOL_NAME_RE = /^[A-Za-z0-9_-]{1,128}$/;
let id = 0;
let failures = 0;

async function rpc(method, params, { notify = false } = {}) {
    const body = { jsonrpc: '2.0', method, ...(params ? { params } : {}), ...(notify ? {} : { id: ++id }) };
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: process.env.MCP_ACCEPT || 'application/json, text/event-stream',
            'MCP-Protocol-Version': '2025-06-18',
            'X-Workout-Mate-Key': key,
            // Vercel 미리보기 Deployment Protection 우회 (Settings > Deployment Protection > Protection Bypass for Automation)
            ...(process.env.VERCEL_BYPASS ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS } : {}),
        },
        body: JSON.stringify(body),
    });
    const textBody = await res.text();
    if (notify) return { status: res.status };
    let json;
    try {
        json = JSON.parse(textBody);
    } catch {
        throw new Error(`${method}: JSON이 아닌 응답 (HTTP ${res.status}) ${textBody.slice(0, 200)}`);
    }
    if (json.error) throw new Error(`${method}: HTTP ${res.status} ${json.error.message}`);
    return json.result;
}

function check(ok, label) {
    if (!ok) failures += 1;
    console.log(`${ok ? '✅' : '❌'} ${label}`);
}

async function callTool(name, args = {}) {
    const started = Date.now();
    const result = await rpc('tools/call', { name, arguments: args });
    const ms = Date.now() - started;
    const onlyText = result.content.every(c => c.type === 'text');
    check(!result.isError && onlyText, `${name}(${JSON.stringify(args)}) ${ms}ms${result.isError ? ' [isError]' : ''}`);
    const out = result.content.map(c => c.text).join('\n');
    console.log(out.split('\n').slice(0, 25).map(l => `    ${l}`).join('\n'));
    if (out.split('\n').length > 25) console.log('    …');
    console.log();
    return out;
}

const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'mcp-smoke', version: '1.0.0' },
});
check(!!init.serverInfo, `initialize: ${init.serverInfo?.name} ${init.serverInfo?.version}, protocol ${init.protocolVersion}`);
const n = await rpc('notifications/initialized', undefined, { notify: true });
check(n.status === 202, `notifications/initialized → HTTP ${n.status}`);

// GET SSE 스트림: PlayMCP 검증기는 initialize 후 GET을 열고, 405면 연결 실패로 처리한다
{
    const ac = new AbortController();
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'text/event-stream',
            'X-Workout-Mate-Key': key,
            ...(process.env.VERCEL_BYPASS ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS } : {}),
        },
        signal: ac.signal,
    });
    let first = '';
    if (res.ok && res.body) {
        const reader = res.body.getReader();
        const { value } = await reader.read();
        first = new TextDecoder().decode(value ?? new Uint8Array()).trim();
    }
    ac.abort();
    check(res.status === 200 && (res.headers.get('content-type') ?? '').includes('text/event-stream'),
        `GET SSE 스트림 → HTTP ${res.status} ${res.headers.get('content-type')} ${first}`);
}

const { tools } = await rpc('tools/list');
check(tools.length >= 3 && tools.length <= 20, `tools/list: ${tools.length}개`);
for (const t of tools) {
    const missing = REQUIRED_ANNOTATIONS.filter(k => t.annotations?.[k] === undefined);
    const nameOk = TOOL_NAME_RE.test(t.name) && !/kakao/i.test(t.name);
    check(nameOk && missing.length === 0 && !!t.description && !!t.inputSchema,
        `  ${t.name}${missing.length ? ` (annotations 누락: ${missing.join(', ')})` : ''}${nameOk ? '' : ' (이름 규칙 위반)'}`);
}
console.log();

await callTool('get_my_summary', { period: 'week' });
await callTool('get_my_summary', { period: 'year' });
await callTool('list_my_workouts', { limit: 5 });
const crews = await callTool('list_my_crews');
const firstCrew = crews.match(/^### (.+?)(?: \(크루장\))?$/m)?.[1];
if (firstCrew) {
    await callTool('get_crew_leaderboard', { crew: firstCrew, period: 'month', workout_type: 'running' });
    await callTool('get_crew_feed', { crew: firstCrew, limit: 5 });
}
await callTool('search_competitions', { limit: 3 });
await callTool('get_announcements', { limit: 2 });

// --write: 쓰기 툴 점검. 운영 DB에 '나만 보기' 테스트 기록이 생기므로 끝난 뒤 앱에서(또는 별도 정리로) 삭제할 것
if (process.argv.includes('--write')) {
    console.log('--- 쓰기 툴 점검 (나만 보기 기록 1건 생성) ---\n');
    const logged = await callTool('log_workout', {
        workout_type: 'running', distance: 1, duration_seconds: 600, sharing_type: 'private',
    });
    const workoutId = logged.match(/workouts\/([0-9a-f-]{36})/)?.[1];
    check(!!workoutId, `생성된 기록 id: ${workoutId ?? '찾지 못함'}`);

    if (workoutId) {
        await callTool('cheer_workout', { workout_id: workoutId, emoji: '👍', comment: 'MCP 점검용 댓글' });
        await callTool('cheer_workout', { workout_id: workoutId, emoji: '🔥' }); // 반응 변경(upsert)
        const mine = await callTool('list_my_workouts', { limit: 1 });
        check(mine.includes(workoutId) && mine.includes('나만 보기'), '방금 만든 기록이 나만 보기로 조회됨');
    }

    // 이미 참가 표시한 대회는 건드리지 않도록, 참가 예정이 아닌 대회만 골라 표시 → 취소
    const comps = await rpc('tools/call', { name: 'search_competitions', arguments: { limit: 20 } });
    const blocks = comps.content[0].text.split('\n### ').slice(1);
    const target = blocks.find(b => !b.includes('✅ 참가 예정'));
    const compId = target?.match(/competition_id: `([0-9a-f-]{36})`/)?.[1];
    if (compId) {
        await callTool('join_competition', { competition_id: compId, join: true });
        const joined = await rpc('tools/call', { name: 'search_competitions', arguments: { only_joined: true, limit: 20 } });
        check(joined.content[0].text.includes(compId), '참가 표시 후 only_joined 검색에 나타남');
        await callTool('join_competition', { competition_id: compId, join: false });
        const after = await rpc('tools/call', { name: 'search_competitions', arguments: { only_joined: true, limit: 20 } });
        check(!after.content[0].text.includes(compId), '참가 취소 후 only_joined 검색에서 사라짐');
    } else {
        console.log('참가 표시하지 않은 대회가 없어 join_competition 점검은 건너뜀\n');
    }

    // 입력 검증: 미래 날짜는 거부되어야 함
    const bad = await rpc('tools/call', { name: 'log_workout', arguments: { workout_type: 'running', distance: 5, duration_seconds: 1500, workout_date: '2999-01-01' } });
    check(bad.isError === true, `미래 날짜 거부: ${bad.content[0].text}`);

    if (workoutId) console.log(`\n정리할 테스트 기록 id: ${workoutId}`);
}

console.log(failures === 0 ? '모든 점검 통과' : `실패 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);
