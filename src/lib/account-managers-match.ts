import type { AccountManager } from '@/lib/account-managers';

/** Exact match on the trimmed name. Pure, so the form, the server action and tests share it. */
export function isAccountManager(name: string, list: readonly AccountManager[]): boolean {
  const wanted = name.trim();
  return wanted.length > 0 && list.some((m) => m.name === wanted);
}
