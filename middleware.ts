import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api/mcp (외부 AI 비서용 MCP 엔드포인트: 쿠키 세션을 쓰지 않고, 세션 갱신 왕복이 응답을 늦춤)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|api/mcp(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
