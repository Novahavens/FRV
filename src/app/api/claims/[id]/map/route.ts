import { serveImage } from '@/lib/maps/image-route';
import { staticMapUrl } from '@/lib/maps/google-static';
import { mapPins } from '@/lib/maps/report-imagery';

/** Hybrid map of the loss address and comps, proxied so the key stays server-side. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return serveImage(id, (key, claim) => staticMapUrl(key, mapPins(claim)));
}
