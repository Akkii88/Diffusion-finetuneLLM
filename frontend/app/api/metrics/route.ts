import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET() {
    try {
        const res = await fetch(`${API_URL}/metrics`);
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 503 });
    }
}
