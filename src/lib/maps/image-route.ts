import 'server-only';
import {
  ClaimNotFoundError,
  NotLockedError,
  loadLockedClaim,
  type StoredClaim,
} from '@/lib/db/claims';
import { DEMO_CLAIM_ID, demoClaim } from '@/lib/report/demo';
import { isConfigured } from '@/lib/env';
import { fetchImage, mapsKey } from './google-static';

/**
 * Shared body of the two image routes. Responses never contain the Google URL
 * or key: failures are bare status codes.
 */
export async function serveImage(
  id: string,
  buildUrl: (key: string, claim: StoredClaim) => string,
): Promise<Response> {
  const key = mapsKey();
  if (!key) return new Response(null, { status: 404 });

  let claim: StoredClaim;
  try {
    claim = !isConfigured() && id === DEMO_CLAIM_ID ? demoClaim() : await loadLockedClaim(id);
  } catch (error) {
    if (error instanceof ClaimNotFoundError) return new Response(null, { status: 404 });
    if (error instanceof NotLockedError) return new Response(null, { status: 409 });
    return new Response(null, { status: 500 });
  }

  const image = await fetchImage(buildUrl(key, claim));
  if (!image) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
