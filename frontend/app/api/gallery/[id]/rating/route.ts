import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
        const { searchParams } = new URL(request.url);
        const rating = searchParams.get("rating");
        const res = await fetch(`${API_URL}/gallery/${params.id}/rating?rating=${rating}`, {
            method: "PATCH",
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update rating" }, { status: 503 });
    }
}
