// Workout Mate MCP 엔드포인트 (Streamable HTTP, stateless). PlayMCP 등 외부 AI 비서가 호출한다.
// 인증: X-Workout-Mate-Key 헤더(또는 Authorization: Bearer)의 개인 연결 키 → lib/mcp/keys.ts
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateMcpKey, checkRateLimit, MCP_KEY_HEADER } from '@/lib/mcp/keys';
import { createWorkoutMateServer } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function jsonRpcError(status: number, message: string) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message }, id: null }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/** 진단용 로그 (키 값은 남기지 않음) */
function logRequest(request: Request, rpcMethod: string, status: number, note = '') {
    const h = request.headers;
    console.log('[mcp]', JSON.stringify({
        rpc: rpcMethod,
        status,
        accept: h.get('accept'),
        contentType: h.get('content-type'),
        protocolVersion: h.get('mcp-protocol-version'),
        hasKeyHeader: h.has(MCP_KEY_HEADER),
        hasAuthorization: h.has('authorization'),
        userAgent: h.get('user-agent'),
        note,
    }));
}

function rpcMethodOf(body: string): string {
    try {
        const parsed = JSON.parse(body);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        return list.map((m: any) => m?.method ?? (m?.result !== undefined ? 'response' : '?')).join(',');
    } catch {
        return 'invalid-json';
    }
}

export async function POST(request: Request) {
    const body = await request.text();
    const rpc = rpcMethodOf(body);

    const user = await authenticateMcpKey(request);
    if (!user) {
        logRequest(request, rpc, 401, 'auth');
        return jsonRpcError(401, '유효한 Workout Mate 연결 키가 필요해요. 앱의 내 정보 > AI 비서 연결에서 발급할 수 있어요.');
    }
    if (!checkRateLimit(user.keyId)) {
        logRequest(request, rpc, 429);
        return jsonRpcError(429, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
    }

    // SDK는 Accept에 application/json과 text/event-stream이 모두 있어야 받아 준다(없으면 406).
    // 이 서버는 항상 JSON으로만 응답하므로, 둘 중 하나만 보내는 클라이언트(일부 등록 검증기 등)도 받도록 보정한다.
    const headers = new Headers(request.headers);
    const accept = headers.get('accept') ?? '';
    if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
        headers.set('accept', 'application/json, text/event-stream');
    }
    if (!headers.get('content-type')?.includes('application/json')) {
        headers.set('content-type', 'application/json');
    }
    const normalized = new Request(request.url, { method: 'POST', headers, body });

    const server = createWorkoutMateServer(user, new URL(request.url).origin);
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
        const response = await transport.handleRequest(normalized);
        if (response.status >= 400 || rpc === 'initialize') logRequest(request, rpc, response.status);
        return response;
    } finally {
        // JSON 응답 모드에서는 handleRequest가 응답 본문을 다 만든 뒤 반환한다
        await transport.close();
        await server.close();
    }
}

// GET: 서버 → 클라이언트 알림용 SSE 스트림.
// 스펙상 405로 거절해도 되지만, PlayMCP 연결 검증기(Java 클라이언트)는 initialize 후 GET이 405면
// tools/list로 넘어가지 않고 연결 실패로 처리한다(2026-11-28 Vercel 로그로 확인).
// 이 서버는 보낼 알림이 없으므로 keep-alive 주석만 보내다가 짧은 시간 뒤 스트림을 닫는다.
const SSE_PING_MS = 10_000;
const SSE_MAX_MS = 25_000;

export async function GET(request: Request) {
    const user = await authenticateMcpKey(request);
    if (!user) {
        logRequest(request, 'GET', 401, 'auth');
        return jsonRpcError(401, '유효한 Workout Mate 연결 키가 필요해요. 앱의 내 정보 > AI 비서 연결에서 발급할 수 있어요.');
    }
    if (!checkRateLimit(user.keyId)) {
        logRequest(request, 'GET', 429);
        return jsonRpcError(429, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
    }
    logRequest(request, 'GET', 200, 'sse');

    const encoder = new TextEncoder();
    let ping: ReturnType<typeof setInterval> | undefined;
    let stop: ReturnType<typeof setTimeout> | undefined;
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            const close = () => {
                if (closed) return;
                closed = true;
                clearInterval(ping);
                clearTimeout(stop);
                try { controller.close(); } catch { /* 이미 닫힘 */ }
            };
            controller.enqueue(encoder.encode(': connected\n\n'));
            ping = setInterval(() => {
                try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { close(); }
            }, SSE_PING_MS);
            stop = setTimeout(close, SSE_MAX_MS);
            request.signal.addEventListener('abort', close);
        },
        cancel() {
            clearInterval(ping);
            clearTimeout(stop);
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    });
}

// stateless 서버라 세션 종료(DELETE)는 지원하지 않음
export function DELETE(request: Request) {
    logRequest(request, 'DELETE', 405);
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'GET, POST' },
    });
}
