import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.HOSTEX_API_TOKEN;
  const baseUrl = process.env.HOSTEX_API_BASE || 'https://openapi.hostex.com';

  if (!token) {
    return NextResponse.json({ error: 'HOSTEX_API_TOKEN not configured' }, { status: 500 });
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  });

  try {
    const res = await fetch(`${baseUrl}/conversations?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
