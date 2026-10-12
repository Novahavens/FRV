import 'server-only';
import { DEFAULT_ACCOUNT_MANAGERS, type AccountManager } from '@/lib/account-managers';
import { isConfigured } from '@/lib/env';
import { db } from './client';

/**
 * Active account managers, in display order. Falls back to the built-in list
 * when Supabase is not configured, the query fails, or the table is empty:
 * a form with no names is a form nobody can submit.
 */
export async function listAccountManagers(): Promise<AccountManager[]> {
  const fallback = () => [...DEFAULT_ACCOUNT_MANAGERS];
  if (!isConfigured()) return fallback();

  try {
    const { data, error } = await db()
      .from('account_managers')
      .select('name')
      .eq('active', true)
      .order('sort_order')
      .order('name');
    if (error || !data || data.length === 0) return fallback();
    return data.map((row) => ({ name: String(row.name) }));
  } catch {
    return fallback();
  }
}

export { isAccountManager } from '@/lib/account-managers-match';
