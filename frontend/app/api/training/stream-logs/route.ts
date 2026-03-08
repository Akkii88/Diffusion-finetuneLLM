import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

/**
 * SSE proxy: forwards the FastAPI /training/stream-logs SSE stream to the browser.
 * Next.js App Router streaming response.
 */
export async function GET(request: NextRequest) {
    try {
        const backendRes = await fetch(`${BACKEND_URL}/training/stream-logs`, {
            headers: { Accept: 'text/event-stream' },
            // @ts-ignore — Node fetch supports duplex streaming
            duplex: 'half',
            cache: 'no-store',
            signal: request.signal,
        });

        return new Response(backendRes.body, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'X-Accel-Buffering': 'no',
                Connection: 'keep-alive',
            },
        });
    } catch (error) {
        return new Response('SSE stream unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
}
