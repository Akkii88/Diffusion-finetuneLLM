import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    try {
        const res = await fetch(`${API_URL}/gallery?${searchParams.toString()}`);
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch gallery" }, { status: 503 });
    }
}
