import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
    const url = new URL(request.url);
    const isStop = url.searchParams.get('stop') === 'true';

    try {
        const body = await request.json();
        const endpoint = isStop ? `/training/stop` : `/training/start`;
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: "Failed to start training" }, { status: 503 });
    }
}

export async function GET() {
    try {
        const res = await fetch(`${API_URL}/training/status`);
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: "Failed to get training status" }, { status: 503 });
    }
}
