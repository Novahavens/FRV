import { notFound } from 'next/navigation';
import { buildReportModel } from '@/lib/report/model';
import { ReportSheet } from '@/components/report/ReportSheet';
import { loadLockedClaim } from '@/lib/db/claims';
import { DEMO_CLAIM_ID, demoClaim } from '@/lib/report/demo';
import { isConfigured } from '@/lib/env';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function ReportPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string }>;
}) {
  const { claim: claimId = DEMO_CLAIM_ID } = await searchParams;

  const usingSample = !isConfigured();
  const claim = usingSample
    ? demoClaim()
    : await loadLockedClaim(claimId).catch(() => null);

  if (!claim) notFound();

  const model = buildReportModel(claim.loss, claim.calculation, {
    status: claim.status === 'locked' ? 'Final' : 'Draft',
    version: claim.version,
    photoUrl: claim.photoUrl,
    attribution: claim.attribution,
  });

  return (
    <main className={styles.page}>
      <div className={styles.bar}>
        <p className={styles.barText}>
          {usingSample
            ? 'Sample claim — Supabase is not configured, so this is the Coppell reference.'
            : 'Preview — this is exactly what downloads.'}
        </p>
        <a className={styles.download} href={`/api/claims/${claim.id}/report`}>
          Download PDF
        </a>
      </div>
      <ReportSheet model={model} />
    </main>
  );
}
