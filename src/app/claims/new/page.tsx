import Link from 'next/link';
import { ClaimForm } from './ClaimForm';
import styles from './page.module.css';

export const metadata = { title: 'New FRV — Nova Havens' };

export default function NewClaimPage() {
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
      <ClaimForm />
    </main>
  );
}
