import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const workerUrl = process.env.WORKER_URL;

  if (!workerUrl) {
    return NextResponse.json(
      { ok: false, error: 'WORKER_URL não configurado' },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${workerUrl}/sync`, {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { ok: false, error: `Worker retornou ${res.status}: ${body}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
