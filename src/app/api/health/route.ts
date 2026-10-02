import { db } from '@/lib/db/client';
import { isConfigured } from '@/lib/env';

/** Liveness plus a real dependency check, for the Vercel deploy gate. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isConfigured()) {
    return Response.json({ status: 'misconfigured', database: 'unknown' }, { status: 503 });
  }
  try {
    const { error } = await db().from('claims').select('id').limit(1);
    if (error) throw error;
    return Response.json({ status: 'ok', database: 'reachable' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ status: 'degraded', database: 'unreachable', detail }, { status: 503 });
  }
}
