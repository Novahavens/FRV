/**
 * The people who may appear as "Prepared by" on an FRV.
 *
 * The list lives in Supabase (`account_managers`) so a name can be added or
 * retired without a deploy. This constant is the fallback when Supabase is not
 * configured, so the demo form still works, and the seed for a fresh database.
 */
export interface AccountManager {
  name: string;
}

export const DEFAULT_ACCOUNT_MANAGERS: readonly AccountManager[] = [
  { name: 'Fazal Abed' },
  { name: 'William' },
  { name: 'Louise Jaffe' },
];
