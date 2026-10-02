import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';
import { buildReportModel } from '@/lib/report/model';
import { ReportDocument } from '@/components/report/ReportDocument';
import { ClaimNotFoundError, NotLockedError, loadLockedClaim } from '@/lib/db/claims';

/**
 * Render a locked FRV as a PDF.
 *
 * Node runtime, not edge: react-pdf needs Node streams and the font machinery.
 * Dynamic because a cached report is a report that can disagree with its own
 * record.
 *
 * The figures come from the stored calculation, never from a fresh run of the
 * engine — that is what makes an accepted report permanent.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const claim = await loadLockedClaim(id);
    const model = buildReportModel(claim.loss, claim.calculation, {
      status: claim.status === 'locked' ? 'Final' : 'Draft',
      version: claim.version,
      photoUrl: claim.photoUrl,
      attribution: claim.attribution,
    });

    const buffer = await renderToBuffer(
      createElement(ReportDocument, { model }) as unknown as ReactElement<DocumentProps>,
    );
    const filename = `FRV-${model.claimIdentifier.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        // inline: the adjuster usually reads it in the browser before saving.
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ClaimNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof NotLockedError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: 'Could not render the report.', detail }, { status: 500 });
  }
}
