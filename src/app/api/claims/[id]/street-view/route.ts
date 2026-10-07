import { serveImage } from '@/lib/maps/image-route';
import { streetViewUrl } from '@/lib/maps/google-static';
import { lossLocation } from '@/lib/maps/report-imagery';

/** Street View snapshot of the loss address, proxied so the key stays server-side. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return serveImage(id, (key, claim) => streetViewUrl(key, lossLocation(claim)));
}
