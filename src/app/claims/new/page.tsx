import Link from 'next/link';
import { listAccountManagers } from '@/lib/db/account-managers';
import { ClaimForm } from './ClaimForm';
import styles from './page.module.css';

export const metadata = { title: 'New FRV — Nova Havens' };
// The account-manager list comes from the database on every request, not at build time.
export const dynamic = 'force-dynamic';

export default async function NewClaimPage() {
  const accountManagers = await listAccountManagers();
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>New Fair Rental Value</h1>
          <p className={styles.sub}>
            Three unfurnished comparables, sorted high to low and averaged. The figure
            is the ceiling for the whole claim, so it is calculated before any sourcing begins.
          </p>
        </div>
        <Link href="/" className={styles.back}>Back to workspace</Link>
      </header>
      <ClaimForm accountManagers={accountManagers} />
    </main>
  );
}
