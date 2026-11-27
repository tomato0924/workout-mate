// Workout Mate MCP 읽기 툴 점검 스크립트 (쓰기 툴은 호출하지 않음)
//
// 사용법 (PowerShell):
//   $env:MCP_KEY = "wm_..."                           # 내 정보 > AI 비서 연결에서 발급한 키
//   $env:MCP_URL = "http://localhost:3000/api/mcp"    # 생략 시 이 값. 미리보기 URL도 가능
//   node scripts/mcp-smoke.mjs
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
            Accept: 'application/json, text/event-stream',
            'MCP-Protocol-Version': '2025-06-18',
            'X-Workout-Mate-Key': key,
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

console.log(failures === 0 ? '모든 점검 통과' : `실패 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);
