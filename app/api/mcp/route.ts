// Workout Mate MCP 엔드포인트 (Streamable HTTP, stateless). PlayMCP 등 외부 AI 비서가 호출한다.
// 인증: X-Workout-Mate-Key 헤더(또는 Authorization: Bearer)의 개인 연결 키 → lib/mcp/keys.ts
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateMcpKey, checkRateLimit } from '@/lib/mcp/keys';
import { createWorkoutMateServer } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function jsonRpcError(status: number, message: string) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message }, id: null }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function POST(request: Request) {
    const user = await authenticateMcpKey(request);
    if (!user) {
        return jsonRpcError(401, '유효한 Workout Mate 연결 키가 필요해요. 앱의 내 정보 > AI 비서 연결에서 발급할 수 있어요.');
    }
    if (!checkRateLimit(user.keyId)) {
        return jsonRpcError(429, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
    }

    const server = createWorkoutMateServer(user, new URL(request.url).origin);
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
        return await transport.handleRequest(request);
    } finally {
        // JSON 응답 모드에서는 handleRequest가 응답 본문을 다 만든 뒤 반환한다
        await transport.close();
        await server.close();
    }
}

// stateless 서버라 SSE 스트림(GET)과 세션 종료(DELETE)는 지원하지 않음
const methodNotAllowed = () =>
    new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
